package com.company.opsagent.controlplane.modules.agentruntime;

import java.util.List;
import reactor.core.publisher.Mono;

/**
 * Primary Agent runtime backed by AgentScope Java through a narrow client boundary.
 */
public final class AgentscopePrimaryAgentRuntimeService implements AgentRuntimeService {

  private final AgentToolCatalogProvider catalogProvider;
  private final AgentscopeAgentClient agentClient;

  public AgentscopePrimaryAgentRuntimeService(
      AgentToolCatalogProvider catalogProvider,
      AgentscopeAgentClient agentClient) {
    this.catalogProvider = catalogProvider;
    this.agentClient = agentClient;
  }

  @Override
  public Mono<AgentRuntimeResult> run(AgentRuntimeRequest request) {
    List<AgentToolDescriptor> readOnlyTools = catalogProvider.availableTools().stream()
        .filter(AgentToolDescriptor::isReadOnly)
        .toList();
    return agentClient.run(new AgentscopeAgentInvocation(request, readOnlyTools))
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
