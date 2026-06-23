package com.company.opsagent.controlplane.modules.workflow;

import java.time.OffsetDateTime;

public record StoredAgentWorkflow(
    String workflowId,
    String workspaceId,
    String operatorId,
    String targetEnvironment,
    String idempotencyKey,
    StoredWorkflowStatus status,
    OffsetDateTime createdAt,
    OffsetDateTime updatedAt,
    OffsetDateTime completedAt,
    String resultStatus,
    String resultSummary,
    Integer resultToolCallCount) {

  public StoredAgentWorkflow {
    workflowId = requiredText(workflowId, "workflowId");
    workspaceId = requiredText(workspaceId, "workspaceId");
    operatorId = requiredText(operatorId, "operatorId");
    targetEnvironment = requiredText(targetEnvironment, "targetEnvironment");
    idempotencyKey = requiredText(idempotencyKey, "idempotencyKey");
    if (status == null) {
      throw new IllegalArgumentException("status must not be null");
    }
    if (createdAt == null) {
      throw new IllegalArgumentException("createdAt must not be null");
    }
    if (updatedAt == null) {
      throw new IllegalArgumentException("updatedAt must not be null");
    }
    if (resultToolCallCount != null && resultToolCallCount < 0) {
      throw new IllegalArgumentException("resultToolCallCount must not be negative");
    }
  }

  StoredAgentWorkflow withStatus(StoredWorkflowStatus nextStatus, OffsetDateTime updatedAt, OffsetDateTime completedAt) {
    return withResult(nextStatus, updatedAt, completedAt, resultStatus, resultSummary, resultToolCallCount);
  }

  StoredAgentWorkflow withResult(
      StoredWorkflowStatus nextStatus,
      OffsetDateTime updatedAt,
      OffsetDateTime completedAt,
      String resultStatus,
      String resultSummary,
      Integer resultToolCallCount) {
    return new StoredAgentWorkflow(
        workflowId,
        workspaceId,
        operatorId,
        targetEnvironment,
        idempotencyKey,
        nextStatus,
        createdAt,
        updatedAt,
        completedAt,
        resultStatus,
        resultSummary,
        resultToolCallCount);
  }

  private static String requiredText(String value, String fieldName) {
    if (value == null || value.isBlank()) {
      throw new IllegalArgumentException(fieldName + " must not be blank");
    }
    return value;
  }
}
