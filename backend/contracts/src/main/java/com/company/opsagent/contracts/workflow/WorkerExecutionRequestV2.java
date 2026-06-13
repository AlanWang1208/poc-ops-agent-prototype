package com.company.opsagent.contracts.workflow;

import static com.company.opsagent.contracts.ContractValues.required;
import static com.company.opsagent.contracts.ContractValues.requiredText;
import static com.company.opsagent.contracts.ContractValues.requiredTime;

import java.time.OffsetDateTime;

/**
 * Worker 接收的带 Team Workspace 上下文和过期时间的已授权执行请求。
 */
public record WorkerExecutionRequestV2(
    String contractVersion,
    WorkspaceContext workspace,
    String executionRequestId,
    OffsetDateTime authorizedAt,
    OffsetDateTime expiresAt,
    ReadOnlyCommandEnvelopeV2 command) {

  public WorkerExecutionRequestV2 {
    if (!"2.0".equals(contractVersion)) {
      throw new IllegalArgumentException("unsupported worker request contract version");
    }
    workspace = required(workspace, "workspace");
    executionRequestId = requiredText(executionRequestId, "executionRequestId");
    authorizedAt = requiredTime(authorizedAt, "authorizedAt");
    expiresAt = requiredTime(expiresAt, "expiresAt");
    command = required(command, "command");
    if (!workspace.workspaceId().equals(command.workspace().workspaceId())) {
      throw new IllegalArgumentException("worker request workspace must match command workspace");
    }
    if (!expiresAt.isAfter(authorizedAt)) {
      throw new IllegalArgumentException("expiresAt must be after authorizedAt");
    }
  }
}
