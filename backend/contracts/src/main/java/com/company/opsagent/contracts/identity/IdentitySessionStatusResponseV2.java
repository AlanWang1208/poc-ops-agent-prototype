package com.company.opsagent.contracts.identity;

import static com.company.opsagent.contracts.ContractValues.requiredText;
import static com.company.opsagent.contracts.ContractValues.requiredTime;

import java.time.OffsetDateTime;
import java.util.List;

/**
 * 携带 Team Workspace 列表的浏览器会话查询响应契约。
 */
public record IdentitySessionStatusResponseV2(
    boolean authenticated,
    String subject,
    String username,
    List<String> roles,
    List<WorkspaceSessionView> workspaces,
    String currentWorkspaceId,
    String authenticationType,
    OffsetDateTime sessionExpiresAt,
    boolean passwordChangeRequired) {

  public IdentitySessionStatusResponseV2 {
    roles = roles == null ? List.of() : List.copyOf(roles);
    workspaces = workspaces == null ? List.of() : List.copyOf(workspaces);
    authenticationType = requiredText(authenticationType, "authenticationType");
    if (authenticated) {
      subject = requiredText(subject, "subject");
      username = requiredText(username, "username");
      sessionExpiresAt = requiredTime(sessionExpiresAt, "sessionExpiresAt");
      if (roles.stream().anyMatch(role -> role == null || role.isBlank())) {
        throw new IllegalArgumentException("roles must not contain blank values");
      }
      if (workspaces.isEmpty()) {
        throw new IllegalArgumentException("authenticated session must contain at least one workspace");
      }
      currentWorkspaceId = requiredText(currentWorkspaceId, "currentWorkspaceId");
        String finalCurrentWorkspaceId = currentWorkspaceId;
        boolean currentWorkspaceVisible = workspaces.stream()
          .anyMatch(workspace -> workspace.workspaceId().equals(finalCurrentWorkspaceId));
      if (!currentWorkspaceVisible) {
        throw new IllegalArgumentException("currentWorkspaceId must be visible in workspaces");
      }
    } else if (subject != null
        || username != null
        || !roles.isEmpty()
        || !workspaces.isEmpty()
        || currentWorkspaceId != null
        || sessionExpiresAt != null
        || passwordChangeRequired) {
      throw new IllegalArgumentException("anonymous session must not contain authenticated fields");
    }
  }
}
