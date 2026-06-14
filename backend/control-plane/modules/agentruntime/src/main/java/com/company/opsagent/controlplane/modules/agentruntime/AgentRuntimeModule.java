package com.company.opsagent.controlplane.modules.agentruntime;

/**
 * Agent 主运行时模块元信息定义。
 */
public final class AgentRuntimeModule {

  private AgentRuntimeModule() {
  }

  /**
   * 返回 Agent 路由与模型交互模块编号。
   */
  public static String moduleId() {
    return "M04";
  }
}
