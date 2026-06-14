package com.company.opsagent.contracts.agent;

import static com.company.opsagent.contracts.ContractValues.required;
import static com.company.opsagent.contracts.ContractValues.requiredText;
import static com.company.opsagent.contracts.ContractValues.requiredTime;

import com.fasterxml.jackson.databind.JsonNode;
import java.time.OffsetDateTime;

/**
 * 平台守护 Tool Executor 返回给主 Agent Runtime 的工具调用结果。
 */
public record AgentToolResult(
    String schemaVersion,
    String toolCallId,
    String taskId,
    String workflowId,
    String status,
    String outputSchemaId,
    JsonNode output,
    String errorCode,
    String errorMessage,
    OffsetDateTime completedAt) {

  public AgentToolResult {
    if (!"1.0".equals(schemaVersion)) {
      throw new IllegalArgumentException("unsupported agent tool result schema version");
    }
    toolCallId = requiredText(toolCallId, "toolCallId");
    taskId = requiredText(taskId, "taskId");
    workflowId = requiredText(workflowId, "workflowId");
    status = requiredText(status, "status");
    outputSchemaId = requiredText(outputSchemaId, "outputSchemaId");
    output = required(output, "output");
    completedAt = requiredTime(completedAt, "completedAt");
  }
}
