package com.company.opsagent.controlplane.modules.workflow;

import java.time.OffsetDateTime;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

/**
 * Facts source for Agent-driven workflow state.
 */
public interface AgentWorkflowStore {

  Mono<StoredAgentWorkflow> createOrReuse(
      String workflowId,
      String workspaceId,
      String operatorId,
      String targetEnvironment,
      String idempotencyKey,
      OffsetDateTime createdAt);

  Mono<Void> appendToolStep(StoredAgentToolStep step);

  Mono<Void> markToolStepCompleted(
      String workspaceId,
      String workflowId,
      long stepSequence,
      StoredWorkflowStatus status,
      String errorCode,
      String errorMessage,
      OffsetDateTime completedAt);

  Mono<Void> markWorkflowCompleted(
      String workspaceId,
      String workflowId,
      StoredWorkflowStatus status,
      OffsetDateTime completedAt);

  Flux<StoredAgentToolStep> findToolStepsAfter(String workspaceId, String workflowId, long afterSequence);
}
