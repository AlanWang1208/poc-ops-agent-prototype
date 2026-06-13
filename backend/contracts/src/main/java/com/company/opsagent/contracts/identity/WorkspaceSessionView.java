package com.company.opsagent.contracts.identity;

import static com.company.opsagent.contracts.ContractValues.requiredText;

import java.util.List;

/**
 * 浏览器会话中可访问的 Team Workspace 摘要。
 *
 * @param workspaceId 工作空间稳定标识
 * @param workspaceCode 工作空间短代码
 * @param displayName 工作空间展示名称
 * @param roles 当前用户在该工作空间内的角色
 */
public record WorkspaceSessionView(
    String workspaceId,
    String workspaceCode,
    String displayName,
    List<String> roles) {

  public WorkspaceSessionView {
    workspaceId = requiredText(workspaceId, "workspaceId");
    workspaceCode = requiredText(workspaceCode, "workspaceCode");
    displayName = requiredText(displayName, "displayName");
    roles = roles == null ? List.of() : List.copyOf(roles);
    if (roles.stream().anyMatch(role -> role == null || role.isBlank())) {
      throw new IllegalArgumentException("roles must not contain blank values");
    }
  }
}
