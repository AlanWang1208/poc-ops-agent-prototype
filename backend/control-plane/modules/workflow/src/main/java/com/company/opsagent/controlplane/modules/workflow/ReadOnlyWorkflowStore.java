package com.company.opsagent.controlplane.modules.workflow;

import com.company.opsagent.contracts.events.SemanticEvent;
import com.company.opsagent.contracts.workflow.ReadOnlyCommandEnvelope;
import com.company.opsagent.contracts.workflow.WorkerExecutionResult;
import java.time.OffsetDateTime;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

/**
 * 只读工作流持久化抽象。
 *
 * <p>该接口封装工作流实例、执行尝试和语义事件的存取，供只读工作流主流程与恢复流程共享。
 */
public interface ReadOnlyWorkflowStore {

  Mono<Void> createWorkflow(
      String workflowId,
      String idempotencyKey,
      String operatorId,
      String targetEnvironment,
      String skillId,
      String skillVersion,
      String parametersHash,
      String policyDecisionId,
      String policyVersion,
      String traceId,
      String requestId,
      String commandId,
      ReadOnlyCommandEnvelope command,
      OffsetDateTime createdAt);

  Mono<PersistedReadOnlyWorkflowView> findByIdempotency(
      String idempotencyKey,
      String operatorId,
      String targetEnvironment,
      String skillId,
      String parametersHash);

  Flux<SemanticEvent> loadEventsAfter(String workflowId, long afterSequence);

  Mono<Void> appendEvent(String workflowId, long sequence, SemanticEvent event);

  /**
   * 记录一次新的执行尝试，并把工作流推进到运行中状态。
   */
  Mono<Void> startAttempt(
      String workflowId,
      int attemptNo,
      String executionRequestId,
      StoredWorkflowAttemptKind attemptKind,
      OffsetDateTime startedAt,
      OffsetDateTime expiresAt);

  Mono<Void> markWorkflowCompleted(
      String workflowId,
      StoredWorkflowStatus status,
      WorkerExecutionResult result,
      int attemptNo,
      boolean retryable,
      OffsetDateTime completedAt);

  /**
   * 查找需要恢复的工作流。
   *
   * <p>当前覆盖可重放失败实例，以及执行尝试已过期的在途实例。
   */
  Flux<PersistedReadOnlyWorkflowView> findReplayCandidates(OffsetDateTime updatedBefore);

  /**
   * 标记一次重放开始，并持久化重放尝试。
   */
  Mono<Void> markReplayStarted(
      String workflowId,
      int attemptNo,
      int replayCount,
      String executionRequestId,
      OffsetDateTime startedAt,
      OffsetDateTime expiresAt);
}
