package com.company.opsagent.contracts.workflow;

import static com.company.opsagent.contracts.ContractValues.required;
import static com.company.opsagent.contracts.ContractValues.requiredText;
import static com.company.opsagent.contracts.ContractValues.requiredTime;

import com.fasterxml.jackson.databind.JsonNode;
import java.time.OffsetDateTime;

/**
 * Worker 返回的携带 Team Workspace 上下文的强类型执行结果。
 */
public record WorkerExecutionResultV2(
    String contractVersion,
    String workspaceId,
    String executionRequestId,
    String commandId,
    String workflowId,
    WorkerExecutionStatus status,
    String outputSchemaId,
    JsonNode output,
    String errorCode,
    String errorMessage,
    OffsetDateTime completedAt) {

  public WorkerExecutionResultV2 {
    if (!"2.0".equals(contractVersion)) {
      throw new IllegalArgumentException("unsupported worker result contract version");
    }
    workspaceId = requiredText(workspaceId, "workspaceId");
    executionRequestId = requiredText(executionRequestId, "executionRequestId");
    commandId = requiredText(commandId, "commandId");
    workflowId = requiredText(workflowId, "workflowId");
    status = required(status, "status");
    outputSchemaId = requiredText(outputSchemaId, "outputSchemaId");
    completedAt = requiredTime(completedAt, "completedAt");
  }
}
