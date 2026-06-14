package com.company.opsagent.controlplane.modules.agentruntime;

import reactor.core.publisher.Mono;

@FunctionalInterface
public interface AgentscopeAgentClient {

  Mono<AgentscopeAgentResponse> run(AgentscopeAgentInvocation invocation);
}
