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
    OffsetDateTime completedAt) {

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
  }

  StoredAgentWorkflow withStatus(StoredWorkflowStatus nextStatus, OffsetDateTime updatedAt, OffsetDateTime completedAt) {
    return new StoredAgentWorkflow(
        workflowId,
        workspaceId,
        operatorId,
        targetEnvironment,
        idempotencyKey,
        nextStatus,
        createdAt,
        updatedAt,
        completedAt);
  }

  private static String requiredText(String value, String fieldName) {
    if (value == null || value.isBlank()) {
      throw new IllegalArgumentException(fieldName + " must not be blank");
    }
    return value;
  }
}
