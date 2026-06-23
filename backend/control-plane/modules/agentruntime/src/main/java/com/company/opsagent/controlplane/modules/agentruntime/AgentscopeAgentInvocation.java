package com.company.opsagent.controlplane.modules.agentruntime;

import java.util.List;

/**
 * 单次 AgentScope 调用的完整平台上下文。
 *
 * <p>tools 只描述允许暴露给模型的只读工具集合；toolExecutor 才是真正的服务端执行端口。
 * 这样 ReAct 循环即使收到模型 ToolUse，也只能把意图交回平台边界处理，不能直接触达 Worker
 * 或复用模型提供的授权信息。
 */
public record AgentscopeAgentInvocation(
    AgentRuntimeRequest request,
    List<AgentToolDescriptor> tools,
    AgentToolExecutor toolExecutor) {

  public AgentscopeAgentInvocation {
    if (request == null) {
      throw new IllegalArgumentException("request must not be null");
    }
    tools = List.copyOf(tools == null ? List.of() : tools);
    if (toolExecutor == null) {
      throw new IllegalArgumentException("toolExecutor must not be null");
    }
  }
}
