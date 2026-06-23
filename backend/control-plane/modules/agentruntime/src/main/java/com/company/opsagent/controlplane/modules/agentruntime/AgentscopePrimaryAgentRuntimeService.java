package com.company.opsagent.controlplane.modules.agentruntime;

import java.util.List;
import reactor.core.publisher.Mono;

/**
 * AgentScope Java 支撑的主 Agent Runtime 服务。
 *
 * <p>该服务只负责从平台目录中取出模型可见的只读 Tool，并把运行请求交给
 * AgentScope 客户端。它不做授权决策，也不直接触达 Worker；所有 ToolUse
 * 都必须通过注入的 AgentToolExecutor 回到服务端安全边界。
 */
public final class AgentscopePrimaryAgentRuntimeService implements AgentRuntimeService {

  private final AgentToolCatalogProvider catalogProvider;
  private final AgentscopeAgentClient agentClient;
  private final AgentToolExecutor toolExecutor;

  public AgentscopePrimaryAgentRuntimeService(
      AgentToolCatalogProvider catalogProvider,
      AgentscopeAgentClient agentClient,
      AgentToolExecutor toolExecutor) {
    this.catalogProvider = catalogProvider;
    this.agentClient = agentClient;
    this.toolExecutor = toolExecutor;
  }

  @Override
  public Mono<AgentRuntimeResult> run(AgentRuntimeRequest request) {
    /*
     * 这里仍只把已发布的只读 Skill 暴露给模型。真正授权不在浏览器、不在 Prompt、
     * 也不在 AgentScope SDK 内完成，而是在 toolExecutor 的服务端实现中重新决策。
     */
    List<AgentToolDescriptor> readOnlyTools = catalogProvider.availableTools().stream()
        .filter(AgentToolDescriptor::isReadOnly)
        .toList();
    return agentClient.run(new AgentscopeAgentInvocation(request, readOnlyTools, toolExecutor))
        .map(response -> new AgentRuntimeResult(
            response.status(),
            response.summary(),
            response.toolCallCount()))
        .onErrorReturn(new AgentRuntimeResult(
            "AGENT_RUNTIME_FAILED",
            "AgentScope runtime failed before producing a valid result.",
            0));
  }
}
