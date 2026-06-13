package com.company.opsagent.contracts.agent;

import static com.company.opsagent.contracts.ContractValues.requiredText;
import static com.company.opsagent.contracts.ContractValues.requiredTime;

import java.time.OffsetDateTime;

/**
 * 主 Agent Runtime 返回给工作流的最终任务结果。
 */
public record AgentTaskResult(
    String schemaVersion,
    String taskId,
    String workflowId,
    String status,
    String summary,
    int toolCallCount,
    OffsetDateTime completedAt) {

  public AgentTaskResult {
    if (!"1.0".equals(schemaVersion)) {
      throw new IllegalArgumentException("unsupported agent task result schema version");
    }
    taskId = requiredText(taskId, "taskId");
    workflowId = requiredText(workflowId, "workflowId");
    status = requiredText(status, "status");
    summary = requiredText(summary, "summary");
    if (toolCallCount < 0) {
      throw new IllegalArgumentException("toolCallCount must not be negative");
    }
    completedAt = requiredTime(completedAt, "completedAt");
  }
}
