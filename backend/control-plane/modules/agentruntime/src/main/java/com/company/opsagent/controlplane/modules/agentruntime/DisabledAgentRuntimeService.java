package com.company.opsagent.controlplane.modules.agentruntime;

import reactor.core.publisher.Mono;

/**
 * 默认关闭的 Agent Runtime，实现受控不可用结果。
 */
public final class DisabledAgentRuntimeService implements AgentRuntimeService {

  @Override
  public Mono<AgentRuntimeResult> run(AgentRuntimeRequest request) {
    return Mono.just(new AgentRuntimeResult(
        "AGENT_RUNTIME_DISABLED",
        "Agent Runtime is disabled by configuration.",
        0));
  }
}
