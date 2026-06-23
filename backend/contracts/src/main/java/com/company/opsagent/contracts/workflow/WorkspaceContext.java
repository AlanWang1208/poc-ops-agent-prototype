package com.company.opsagent.contracts.workflow;

import static com.company.opsagent.contracts.ContractValues.requiredText;

/**
 * 跨模块契约共享的团队工作空间上下文。
 *
 * @param workspaceId 稳定的工作空间标识
 * @param workspaceCode 用于配置和界面展示的短编码
 * @param displayName 操作台展示名称
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
