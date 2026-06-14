package com.company.opsagent.controlplane.modules.agentruntime;

import reactor.core.publisher.Mono;

/**
 * 主 Agent Runtime 端口。
 */
public interface AgentRuntimeService {

  /**
   * 执行一次已持久化工作流内的 Agent 诊断任务。
   */
  Mono<AgentRuntimeResult> run(AgentRuntimeRequest request);
}
