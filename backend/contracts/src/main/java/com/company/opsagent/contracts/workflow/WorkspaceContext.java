package com.company.opsagent.contracts.workflow;

import static com.company.opsagent.contracts.ContractValues.requiredText;

/**
 * Team Workspace context used across module contracts.
 *
 * @param workspaceId stable workspace identifier
 * @param workspaceCode short code for configuration and UI
 * @param displayName display name for the operator console
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
