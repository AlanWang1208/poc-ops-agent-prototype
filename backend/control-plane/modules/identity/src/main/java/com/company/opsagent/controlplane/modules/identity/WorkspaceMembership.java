package com.company.opsagent.controlplane.modules.identity;

import java.util.List;

/**
 * 操作人在一个 Team Workspace 内的成员关系和角色。
 *
 * @param workspaceId 工作空间稳定标识
 * @param workspaceCode 工作空间短代码
 * @param displayName 工作空间展示名称
 * @param roles 操作人在该工作空间内的角色
 */
public record WorkspaceMembership(
    String workspaceId,
    String workspaceCode,
    String displayName,
    List<String> roles) {

  public WorkspaceMembership {
    if (workspaceId == null || workspaceId.isBlank()) {
      throw new IllegalArgumentException("workspaceId must not be blank");
    }
    if (workspaceCode == null || workspaceCode.isBlank()) {
      throw new IllegalArgumentException("workspaceCode must not be blank");
    }
    if (displayName == null || displayName.isBlank()) {
      throw new IllegalArgumentException("displayName must not be blank");
    }
    roles = roles == null ? List.of() : List.copyOf(roles);
    if (roles.stream().anyMatch(role -> role == null || role.isBlank())) {
      throw new IllegalArgumentException("roles must not contain blank values");
    }
  }
}
