package com.company.opsagent.controlplane.modules.workflow;

import java.time.OffsetDateTime;

public record StoredReadOnlyWorkflow(
    String workflowId,
    String idempotencyKey,
    String operatorId,
    String targetEnvironment,
    String skillId,
    String skillVersion,
    String parametersHash,
    StoredWorkflowStatus status,
    String policyDecisionId,
    String policyVersion,
    String traceId,
    String requestId,
    String commandId,
    String commandJson,
    int currentAttemptNo,
    int maxReplayCount,
    int replayCount,
    String resultStatus,
    String resultSchemaId,
    String resultPayloadJson,
    String errorCode,
    String errorMessage,
    OffsetDateTime createdAt,
    OffsetDateTime updatedAt,
    OffsetDateTime completedAt) {
}
