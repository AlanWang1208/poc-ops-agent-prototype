package com.company.opsagent.controlplane.modules.agentruntime;

import java.util.List;

public record AgentscopeAgentInvocation(
    AgentRuntimeRequest request,
    List<AgentToolDescriptor> tools) {

  public AgentscopeAgentInvocation {
    if (request == null) {
      throw new IllegalArgumentException("request must not be null");
    }
    tools = List.copyOf(tools == null ? List.of() : tools);
  }
}
