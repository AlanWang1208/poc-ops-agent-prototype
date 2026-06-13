package com.company.opsagent.controlplane.modules.agentruntime;

import com.company.opsagent.contracts.agent.AgentToolCall;
import com.company.opsagent.contracts.agent.AgentToolResult;
import reactor.core.publisher.Mono;

/**
 * Agent Tool 调用执行端口。
 */
public interface AgentToolExecutor {

  Mono<AgentToolResult> execute(AgentToolCall toolCall);
}
