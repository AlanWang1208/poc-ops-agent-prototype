package com.company.opsagent.controlplane.modules.agentruntime;

import com.company.opsagent.contracts.agent.AgentToolCall;
import com.company.opsagent.contracts.agent.AgentToolResult;
import com.company.opsagent.contracts.workflow.PolicyDecisionReference;
import com.company.opsagent.contracts.workflow.SkillReference;
import com.company.opsagent.contracts.workflow.TraceContext;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Clock;
import java.time.OffsetDateTime;
import java.util.HexFormat;
import java.util.List;
import java.util.Map;
import java.util.TreeMap;
import reactor.core.publisher.Mono;

/**
 * 本地可见联调用的确定性 Agent 客户端。
 *
 * <p>该客户端只在显式配置 provider=local-weather-smoke 时启用，用于无外部模型 Key 的本地烟测。它只生成
 * weather-current-read 的 ToolCall，真实执行仍必须经过注入的 AgentToolExecutor。
 */
public final class LocalWeatherSmokeAgentClient implements AgentscopeAgentClient {

  private static final String WEATHER_SKILL_ID = "weather-current-read";
  private static final String SCHEMA_VERSION = "1.0";
  private static final String DEFAULT_LOCATION = "Shanghai";
  private static final String PLACEHOLDER_POLICY_VERSION = "local-weather-smoke-intent";

  private final ObjectMapper objectMapper;
  private final Clock clock;

  public LocalWeatherSmokeAgentClient() {
    this(new ObjectMapper(), Clock.systemUTC());
  }

  LocalWeatherSmokeAgentClient(ObjectMapper objectMapper, Clock clock) {
    this.objectMapper = objectMapper;
    this.clock = clock;
  }

  @Override
  public Mono<AgentscopeAgentResponse> run(AgentscopeAgentInvocation invocation) {
    return Mono.defer(() -> {
      AgentToolDescriptor weatherTool = invocation.tools().stream()
          .filter(tool -> WEATHER_SKILL_ID.equals(tool.skillId()))
          .findFirst()
          .orElse(null);
      if (weatherTool == null) {
        return Mono.just(new AgentscopeAgentResponse(
            "AGENT_RUNTIME_FAILED",
            "Local weather smoke agent could not find weather-current-read.",
            0));
      }

      AgentToolCall toolCall = toToolCall(invocation.request(), weatherTool);
      return invocation.toolExecutor().execute(invocation.request(), toolCall)
          .map(result -> new AgentscopeAgentResponse(
              "SUCCEEDED".equals(result.status()) ? "SUCCEEDED" : "AGENT_RUNTIME_FAILED",
              summary(result),
              1,
              List.of(result)))
          .onErrorReturn(new AgentscopeAgentResponse(
              "AGENT_RUNTIME_FAILED",
              "Local weather smoke agent failed before producing a valid result.",
              0));
    });
  }

  private AgentToolCall toToolCall(
      AgentRuntimeRequest request,
      AgentToolDescriptor tool) {
    Map<String, String> parameters = Map.of("location", location(request));
    String toolCallId = request.workflowId() + ":" + WEATHER_SKILL_ID + ":1";
    return new AgentToolCall(
        SCHEMA_VERSION,
        toolCallId,
        request.taskId(),
        request.workflowId(),
        1,
        new SkillReference(
            tool.skillId(),
            tool.version(),
            tool.parameterSchemaId(),
            tool.outputSchemaId()),
        request.targetEnvironment(),
        parameters,
        parametersHash(parameters),
        placeholderPolicyDecision(request.workflowId(), toolCallId),
        new TraceContext(request.traceId(), request.requestId()),
        OffsetDateTime.now(clock));
  }

  private String location(AgentRuntimeRequest request) {
    String explicitLocation = request.inputParameters().get("location");
    if (explicitLocation != null && !explicitLocation.isBlank()) {
      return explicitLocation;
    }
    return DEFAULT_LOCATION;
  }

  private String summary(AgentToolResult result) {
    JsonNode output = result.output();
    if (output.hasNonNull("location")
        && output.hasNonNull("condition")
        && output.hasNonNull("temperatureCelsius")) {
      return "天气查询完成：%s %s %s°C".formatted(
          output.path("location").asText(),
          output.path("condition").asText(),
          output.path("temperatureCelsius").asText());
    }
    return "天气查询完成。";
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

  private PolicyDecisionReference placeholderPolicyDecision(
      String workflowId,
      String toolCallId) {
    return new PolicyDecisionReference(
        PLACEHOLDER_POLICY_VERSION + ":" + workflowId + ":" + toolCallId,
        PLACEHOLDER_POLICY_VERSION,
        "ALLOW");
  }
}
