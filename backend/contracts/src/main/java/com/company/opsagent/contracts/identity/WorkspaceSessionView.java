package com.company.opsagent.contracts.identity;

import static com.company.opsagent.contracts.ContractValues.requiredText;

import java.util.List;

/**
 * Team Workspace summary visible in a browser session.
 *
 * @param workspaceId stable workspace identifier
 * @param workspaceCode short workspace code
 * @param displayName workspace display name
 * @param roles roles granted to the current user in this workspace
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
