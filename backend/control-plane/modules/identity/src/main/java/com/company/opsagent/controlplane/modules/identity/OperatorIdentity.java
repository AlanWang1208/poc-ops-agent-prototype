package com.company.opsagent.controlplane.modules.identity;

import java.util.List;

/**
 * 系统内部统一的操作人身份模型。
 *
 * @param subject 身份主体唯一标识，通常来自 JWT `sub`
 * @param username 便于展示和审计的用户名
 * @param roles 经过标准化处理后的角色列表
 */
public record OperatorIdentity(
    String subject,
    String username,
    List<String> roles,
    String currentWorkspaceId,
    List<WorkspaceMembership> workspaces) {

  public OperatorIdentity(String subject, String username, List<String> roles) {
    this(
        subject,
        username,
        roles,
        TeamWorkspaceConstants.DEFAULT_WORKSPACE_ID,
        List.of(new WorkspaceMembership(
            TeamWorkspaceConstants.DEFAULT_WORKSPACE_ID,
            TeamWorkspaceConstants.DEFAULT_WORKSPACE_CODE,
            TeamWorkspaceConstants.DEFAULT_WORKSPACE_NAME,
            roles)));
  }

  /**
   * 防御性复制角色和工作空间列表，避免外部修改内部状态。
   */
  public OperatorIdentity {
    roles = List.copyOf(roles);
    workspaces = workspaces == null ? List.of() : List.copyOf(workspaces);
    if (subject == null || subject.isBlank()) {
      throw new IllegalArgumentException("subject must not be blank");
    }
    if (username == null || username.isBlank()) {
      throw new IllegalArgumentException("username must not be blank");
    }
    if (roles.stream().anyMatch(role -> role == null || role.isBlank())) {
      throw new IllegalArgumentException("roles must not contain blank values");
    }
    if (currentWorkspaceId == null || currentWorkspaceId.isBlank()) {
      throw new IllegalArgumentException("currentWorkspaceId must not be blank");
    }
    boolean currentWorkspaceVisible = workspaces.stream()
        .anyMatch(workspace -> workspace.workspaceId().equals(currentWorkspaceId));
    if (!currentWorkspaceVisible) {
      throw new IllegalArgumentException("currentWorkspaceId must be visible in workspaces");
    }
  }

  /**
   * 校验请求选择的工作空间是否属于当前操作人。
   */
  public boolean hasWorkspace(String workspaceId) {
    return workspaces.stream().anyMatch(workspace -> workspace.workspaceId().equals(workspaceId));
  }

  /**
   * 返回操作人在指定工作空间内的角色。
   */
  public List<String> rolesForWorkspace(String workspaceId) {
    return workspaces.stream()
        .filter(workspace -> workspace.workspaceId().equals(workspaceId))
        .findFirst()
        .map(WorkspaceMembership::roles)
        .orElse(List.of());
  }
}
