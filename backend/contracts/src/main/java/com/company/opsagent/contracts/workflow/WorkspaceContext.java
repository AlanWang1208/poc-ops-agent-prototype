package com.company.opsagent.contracts.workflow;

import static com.company.opsagent.contracts.ContractValues.requiredText;

/**
 * Team Workspace 的跨模块上下文。
 *
 * @param workspaceId 工作空间稳定标识
 * @param workspaceCode 面向配置和界面的短代码
 * @param displayName 面向操作台展示的名称
 */
public record WorkspaceContext(
    String workspaceId,
    String workspaceCode,
    String displayName) {

  public WorkspaceContext {
    workspaceId = requiredText(workspaceId, "workspaceId");
    workspaceCode = requiredText(workspaceCode, "workspaceCode");
    displayName = requiredText(displayName, "displayName");
  }
}
