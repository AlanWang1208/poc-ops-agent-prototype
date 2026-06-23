package com.company.opsagent.controlplane.modules.agentruntime;

import com.company.opsagent.contracts.agent.AgentToolCall;
import com.company.opsagent.contracts.agent.AgentToolResult;
import reactor.core.publisher.Mono;

/**
 * Agent Tool 调用执行端口。
 *
 * <p>主 Agent Runtime 只能通过这个端口请求工具执行，不能直接触达 Worker、目标系统或策略实现。
 * 执行端必须拿到完整的 Runtime 上下文，才能在服务端重新校验操作人、角色、工作区、
 * 目标环境和链路追踪信息，避免把客户端或模型提供的 ToolCall 当作授权事实。
 */
public interface AgentToolExecutor {

  /**
   * 执行一次 Agent ToolCall。
   *
   * @param runtimeRequest 控制面传入 Agent Runtime 的可信运行上下文
   * @param toolCall Agent Runtime 提出的工具调用请求，只能作为意图和参数来源
   * @return 平台守护后的工具调用结果
   */
  Mono<AgentToolResult> execute(AgentRuntimeRequest runtimeRequest, AgentToolCall toolCall);
}
