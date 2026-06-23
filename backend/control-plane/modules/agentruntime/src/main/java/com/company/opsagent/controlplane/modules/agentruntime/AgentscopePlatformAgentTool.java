package com.company.opsagent.controlplane.modules.agentruntime;

import com.company.opsagent.contracts.agent.AgentToolCall;
import com.company.opsagent.contracts.agent.AgentToolResult;
import com.company.opsagent.contracts.workflow.PolicyDecisionReference;
import com.company.opsagent.contracts.workflow.SkillReference;
import com.company.opsagent.contracts.workflow.TraceContext;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import io.agentscope.core.message.TextBlock;
import io.agentscope.core.message.ToolResultBlock;
import io.agentscope.core.message.ToolUseBlock;
import io.agentscope.core.tool.AgentTool;
import io.agentscope.core.tool.ToolCallParam;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Clock;
import java.time.OffsetDateTime;
import java.util.HexFormat;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.TreeMap;
import java.util.concurrent.atomic.AtomicLong;
import reactor.core.publisher.Mono;

/**
 * 将 AgentScope SDK 的 AgentTool 调用适配为平台 AgentToolExecutor 调用。
 *
 * <p>这个类只做“模型工具意图”到强类型 ToolCall 信封的转换，不做最终授权。M05
 * 的 WorkflowBackedAgentToolExecutor 会重新校验目录、重算参数哈希、重新执行策略决策，
 * 并负责 Tool Step、Worker 命令和审计事实。这里传入的 policyDecision 只是满足当前
 * AgentToolCall 契约的非权威占位引用，不能被任何执行端当作授权事实。
 */
final class AgentscopePlatformAgentTool implements AgentTool {

  private static final String SCHEMA_VERSION = "1.0";
  private static final String PLACEHOLDER_POLICY_VERSION = "agent-runtime-intent";

  private final AgentRuntimeRequest runtimeRequest;
  private final AgentToolDescriptor descriptor;
  private final AgentToolExecutor toolExecutor;
  private final AtomicLong stepSequence;
  private final ObjectMapper objectMapper;
  private final Clock clock;

  AgentscopePlatformAgentTool(
      AgentRuntimeRequest runtimeRequest,
      AgentToolDescriptor descriptor,
      AgentToolExecutor toolExecutor,
      AtomicLong stepSequence,
      ObjectMapper objectMapper,
      Clock clock) {
    this.runtimeRequest = Objects.requireNonNull(runtimeRequest, "runtimeRequest must not be null");
    this.descriptor = Objects.requireNonNull(descriptor, "descriptor must not be null");
    this.toolExecutor = Objects.requireNonNull(toolExecutor, "toolExecutor must not be null");
    this.stepSequence = Objects.requireNonNull(stepSequence, "stepSequence must not be null");
    this.objectMapper = Objects.requireNonNull(objectMapper, "objectMapper must not be null");
    this.clock = Objects.requireNonNull(clock, "clock must not be null");
  }

  @Override
  public String getName() {
    return descriptor.skillId();
  }

  @Override
  public String getDescription() {
    return descriptor.description();
  }

  @Override
  public Map<String, Object> getParameters() {
    return parameterSchema(descriptor.parameterNames());
  }

  @Override
  public Map<String, Object> getOutputSchema() {
    return Map.of(
        "type", "object",
        "schemaId", descriptor.outputSchemaId());
  }

  @Override
  public Mono<ToolResultBlock> callAsync(ToolCallParam param) {
    return Mono.defer(() -> {
      ToolUseBlock toolUse = param.getToolUseBlock();
      if (toolUse != null
          && toolUse.getName() != null
          && !descriptor.skillId().equals(toolUse.getName())) {
        return Mono.just(ToolResultBlock.error("tool name does not match the registered platform tool"));
      }

      Map<String, String> parameters;
      try {
        parameters = normalizeParameters(param.getInput());
      } catch (IllegalArgumentException exception) {
        return Mono.just(ToolResultBlock.error(exception.getMessage()));
      }

      long sequence = stepSequence.incrementAndGet();
      String toolCallId = toolCallId(toolUse, sequence);
      /*
       * M04 这里生成完整 AgentToolCall 是为了让 ReAct 工具回调进入统一平台契约。
       * policyDecision 和 parametersHash 不能作为授权事实；M05 执行器会重新计算并覆盖。
       */
      AgentToolCall toolCall = new AgentToolCall(
          SCHEMA_VERSION,
          toolCallId,
          runtimeRequest.taskId(),
          runtimeRequest.workflowId(),
          sequence,
          new SkillReference(
              descriptor.skillId(),
              descriptor.version(),
              descriptor.parameterSchemaId(),
              descriptor.outputSchemaId()),
          runtimeRequest.targetEnvironment(),
          parameters,
          parametersHash(parameters),
          placeholderPolicyDecision(toolCallId),
          new TraceContext(runtimeRequest.traceId(), runtimeRequest.requestId()),
          OffsetDateTime.now(clock));

      return toolExecutor.execute(runtimeRequest, toolCall)
          .map(this::toToolResultBlock)
          .onErrorReturn(ToolResultBlock.error("platform tool execution failed"));
    });
  }

  private Map<String, Object> parameterSchema(List<String> parameterNames) {
    Map<String, Object> properties = new LinkedHashMap<>();
    for (String parameterName : parameterNames) {
      properties.put(parameterName, Map.of("type", "string"));
    }
    return Map.of(
        "type", "object",
        "properties", properties,
        "required", parameterNames);
  }

  /**
   * 模型输出是不可信数据，只允许目录中声明过的字符串参数穿过 M04 边界。
   */
  private Map<String, String> normalizeParameters(Map<String, Object> rawInput) {
    Map<String, Object> input = rawInput == null ? Map.of() : rawInput;
    List<String> expectedNames = descriptor.parameterNames();
    List<String> extraNames = input.keySet().stream()
        .filter(name -> !expectedNames.contains(name))
        .sorted()
        .toList();
    if (!extraNames.isEmpty()) {
      throw new IllegalArgumentException("tool parameters contain undeclared fields");
    }

    Map<String, String> normalized = new LinkedHashMap<>();
    for (String expectedName : expectedNames) {
      if (!input.containsKey(expectedName)) {
        throw new IllegalArgumentException("tool parameters are missing required fields");
      }
      Object value = input.get(expectedName);
      if (!(value instanceof String text)) {
        throw new IllegalArgumentException("tool parameters must be strings");
      }
      normalized.put(expectedName, text);
    }
    return Map.copyOf(normalized);
  }

  private String toolCallId(ToolUseBlock toolUse, long sequence) {
    if (toolUse != null && toolUse.getId() != null && !toolUse.getId().isBlank()) {
      return toolUse.getId();
    }
    return runtimeRequest.workflowId() + ":" + descriptor.skillId() + ":" + sequence;
  }

  private String parametersHash(Map<String, String> parameters) {
    try {
      byte[] canonicalJson = objectMapper.writeValueAsBytes(new TreeMap<>(parameters));
      return "sha256:" + HexFormat.of().formatHex(sha256().digest(canonicalJson));
    } catch (JsonProcessingException exception) {
      throw new IllegalArgumentException("tool parameters must be serializable", exception);
    }
  }

  private MessageDigest sha256() {
    try {
      return MessageDigest.getInstance("SHA-256");
    } catch (NoSuchAlgorithmException exception) {
      throw new IllegalStateException("SHA-256 digest is unavailable", exception);
    }
  }

  private PolicyDecisionReference placeholderPolicyDecision(String toolCallId) {
    /*
     * AgentToolCall 当前契约要求携带 ALLOW 引用。这里使用明确的 agent-runtime-intent
     * 占位版本，执行端必须忽略它，并以服务端 M02 决策生成新的 PolicyDecisionReference。
     */
    return new PolicyDecisionReference(
        PLACEHOLDER_POLICY_VERSION + ":" + runtimeRequest.workflowId() + ":" + toolCallId,
        PLACEHOLDER_POLICY_VERSION,
        "ALLOW");
  }

  private ToolResultBlock toToolResultBlock(AgentToolResult result) {
    ObjectNode payload = objectMapper.createObjectNode()
        .put("schemaVersion", result.schemaVersion())
        .put("toolCallId", result.toolCallId())
        .put("taskId", result.taskId())
        .put("workflowId", result.workflowId())
        .put("status", result.status())
        .put("outputSchemaId", result.outputSchemaId());
    payload.set("output", result.output());
    if (result.errorCode() != null) {
      payload.put("errorCode", result.errorCode());
    }
    if (result.errorMessage() != null) {
      payload.put("errorMessage", result.errorMessage());
    }
    payload.put("completedAt", result.completedAt().toString());
    return ToolResultBlock.of(TextBlock.builder().text(payload.toString()).build());
  }
}
