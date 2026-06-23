package com.company.opsagent.controlplane.modules.agentruntime;

import com.fasterxml.jackson.databind.ObjectMapper;
import io.agentscope.core.ReActAgent;
import io.agentscope.core.message.Msg;
import io.agentscope.core.message.MsgRole;
import io.agentscope.core.model.Model;
import io.agentscope.core.tool.Toolkit;
import java.time.Clock;
import java.time.Duration;
import java.util.concurrent.atomic.AtomicLong;
import reactor.core.publisher.Mono;

/**
 * 基于 AgentScope ReActAgent 的主 Agent Runtime 循环。
 *
 * <p>它负责 Prompt、模型和 SDK 工具注册；真实工具执行必须经 AgentToolExecutor
 * 回到平台服务端边界，不能使用 AgentScope 的 SchemaOnlyTool 外部挂起路径绕过策略、
 * workflow、审计或 Worker 隔离。
 */
public final class AgentscopeReActAgentClient implements AgentscopeAgentClient {

  private static final String AGENT_NAME = "ops-agent-primary";
  private static final String SYSTEM_PROMPT = """
      You are the primary enterprise operations diagnostic agent.
      Use only the read-only tools exposed by the platform.
      Do not reveal hidden reasoning. Return a concise auditable diagnostic summary.
      """;

  private final Model model;
  private final int maxIters;
  private final Duration timeout;
  private final ObjectMapper objectMapper;
  private final Clock clock;

  public AgentscopeReActAgentClient(
      Model model,
      int maxIters,
      Duration timeout) {
    this(model, maxIters, timeout, new ObjectMapper(), Clock.systemUTC());
  }

  AgentscopeReActAgentClient(
      Model model,
      int maxIters,
      Duration timeout,
      ObjectMapper objectMapper,
      Clock clock) {
    this.model = model;
    this.maxIters = maxIters;
    this.timeout = timeout;
    this.objectMapper = objectMapper;
    this.clock = clock;
  }

  @Override
  public Mono<AgentscopeAgentResponse> run(AgentscopeAgentInvocation invocation) {
    AtomicLong stepSequence = new AtomicLong();
    Toolkit toolkit = new Toolkit();
    /*
     * 必须注册真实 AgentTool，而不是 registerSchemas。registerSchemas 会创建
     * SchemaOnlyTool 并把执行挂起给外部调用方；这里要让 ReAct 立刻回调平台
     * AgentToolExecutor，由服务端重新授权、记录事实并提交 Worker。
     */
    invocation.tools().stream()
        .filter(AgentToolDescriptor::isReadOnly)
        .map(tool -> new AgentscopePlatformAgentTool(
            invocation.request(),
            tool,
            invocation.toolExecutor(),
            stepSequence,
            objectMapper,
            clock))
        .forEach(toolkit::registerAgentTool);
    ReActAgent agent = ReActAgent.builder()
        .name(AGENT_NAME)
        .sysPrompt(SYSTEM_PROMPT)
        .model(model)
        .toolkit(toolkit)
        .maxIters(maxIters)
        .build();
    return agent.call(toUserMessage(invocation))
        .timeout(timeout)
        .map(message -> new AgentscopeAgentResponse(
            "SUCCEEDED",
            summary(message),
            Math.toIntExact(stepSequence.get())));
  }

  private Msg toUserMessage(AgentscopeAgentInvocation invocation) {
    AgentRuntimeRequest request = invocation.request();
    return Msg.builder()
        .name("operator")
        .role(MsgRole.USER)
        .textContent("""
            workflowId: %s
            targetEnvironment: %s
            userIntent: %s
            inputParameters: %s
            """.formatted(
                request.workflowId(),
                request.targetEnvironment(),
                request.userIntent(),
                request.inputParameters()))
        .build();
  }

  private String summary(Msg message) {
    String text = message.getTextContent();
    if (text == null || text.isBlank()) {
      return "AgentScope runtime completed without a textual summary.";
    }
    return text.strip();
  }
}
