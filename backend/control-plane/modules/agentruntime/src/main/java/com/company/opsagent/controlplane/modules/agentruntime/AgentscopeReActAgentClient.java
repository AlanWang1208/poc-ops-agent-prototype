package com.company.opsagent.controlplane.modules.agentruntime;

import io.agentscope.core.ReActAgent;
import io.agentscope.core.message.Msg;
import io.agentscope.core.message.MsgRole;
import io.agentscope.core.model.Model;
import io.agentscope.core.tool.Toolkit;
import java.time.Duration;
import java.util.concurrent.atomic.AtomicInteger;
import reactor.core.publisher.Mono;

/**
 * AgentScope ReAct agent client used as the primary Agent runtime loop.
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

  public AgentscopeReActAgentClient(
      Model model,
      int maxIters,
      Duration timeout) {
    this.model = model;
    this.maxIters = maxIters;
    this.timeout = timeout;
  }

  @Override
  public Mono<AgentscopeAgentResponse> run(AgentscopeAgentInvocation invocation) {
    AtomicInteger toolCallCount = new AtomicInteger();
    Toolkit toolkit = new Toolkit();
    toolkit.registerSchemas(AgentscopeToolSchemaFactory.fromCatalog(invocation.tools()));
    toolkit.setChunkCallback((toolUse, toolResult) -> toolCallCount.incrementAndGet());
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
            toolCallCount.get()));
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
