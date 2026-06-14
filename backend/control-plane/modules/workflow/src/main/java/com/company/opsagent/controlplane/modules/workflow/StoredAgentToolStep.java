package com.company.opsagent.controlplane.modules.workflow;

import java.time.OffsetDateTime;

public record StoredAgentToolStep(
    String workflowId,
    String workspaceId,
    long stepSequence,
    String toolCallId,
    String skillId,
    String skillVersion,
    String parametersHash,
    String policyDecisionId,
    StoredWorkflowStatus status,
    OffsetDateTime requestedAt,
    OffsetDateTime completedAt,
    String errorCode,
    String errorMessage) {

  public StoredAgentToolStep {
    workflowId = requiredText(workflowId, "workflowId");
    workspaceId = requiredText(workspaceId, "workspaceId");
    if (stepSequence < 1) {
      throw new IllegalArgumentException("stepSequence must be positive");
    }
    toolCallId = requiredText(toolCallId, "toolCallId");
    skillId = requiredText(skillId, "skillId");
    skillVersion = requiredText(skillVersion, "skillVersion");
    parametersHash = requiredText(parametersHash, "parametersHash");
    policyDecisionId = requiredText(policyDecisionId, "policyDecisionId");
    if (status == null) {
      throw new IllegalArgumentException("status must not be null");
    }
    if (requestedAt == null) {
      throw new IllegalArgumentException("requestedAt must not be null");
    }
  }

  StoredAgentToolStep completed(
      StoredWorkflowStatus nextStatus,
      String nextErrorCode,
      String nextErrorMessage,
      OffsetDateTime nextCompletedAt) {
    return new StoredAgentToolStep(
        workflowId,
        workspaceId,
        stepSequence,
        toolCallId,
        skillId,
        skillVersion,
        parametersHash,
        policyDecisionId,
        nextStatus,
        requestedAt,
        nextCompletedAt,
        nextErrorCode,
        nextErrorMessage);
  }

  private static String requiredText(String value, String fieldName) {
    if (value == null || value.isBlank()) {
      throw new IllegalArgumentException(fieldName + " must not be blank");
    }
    return value;
  }
}
