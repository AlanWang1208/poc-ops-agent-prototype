package com.company.opsagent.controlplane.modules.workflow;

import com.company.opsagent.contracts.events.SemanticEvent;
import com.company.opsagent.contracts.events.SemanticEventType;
import com.company.opsagent.contracts.events.WorkflowCompletedPayload;
import com.company.opsagent.contracts.events.WorkflowFailedPayload;
import com.company.opsagent.contracts.workflow.WorkerExecutionRequest;
import com.company.opsagent.contracts.workflow.WorkerExecutionResult;
import com.company.opsagent.contracts.workflow.WorkerExecutionStatus;
import java.time.Clock;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

/**
 * 只读工作流恢复服务。
 *
 * <p>该服务在应用启动或定时恢复时扫描可重放失败实例，以及执行尝试已过期的在途实例，
 * 并在重放次数受控的前提下重新提交到 Worker。
 */
public class ReadOnlyWorkflowRecoveryService {

  private static final long ATTEMPT_TIMEOUT_SECONDS = 30L;

  private final ReadOnlyWorkflowStore workflowStore;
  private final WorkerGateway workerGateway;
  private final Clock clock;
  private final RetryableFailureClassifier retryableFailureClassifier;

  public ReadOnlyWorkflowRecoveryService(
      ReadOnlyWorkflowStore workflowStore,
      WorkerGateway workerGateway,
      Clock clock,
      RetryableFailureClassifier retryableFailureClassifier) {
    this.workflowStore = workflowStore;
    this.workerGateway = workerGateway;
    this.clock = clock;
    this.retryableFailureClassifier = retryableFailureClassifier;
  }

  public Mono<Integer> recoverStaleWorkflows() {
    return workflowStore.findReplayCandidates(OffsetDateTime.now(clock))
        .concatMap(this::replay)
        .reduce(0, Integer::sum)
        .defaultIfEmpty(0);
  }

  private Mono<Integer> replay(PersistedReadOnlyWorkflowView candidate) {
    OffsetDateTime now = OffsetDateTime.now(clock);
    int nextAttemptNo = candidate.workflow().currentAttemptNo() + 1;
    int nextReplayCount = candidate.workflow().replayCount() + 1;
    String executionRequestId = UUID.randomUUID().toString();
    var request = new WorkerExecutionRequest(
        "1.0",
        executionRequestId,
        now,
        now.plusSeconds(ATTEMPT_TIMEOUT_SECONDS),
        candidate.command());
    return workflowStore.markReplayStarted(
            candidate.workflow().workflowId(),
            nextAttemptNo,
            nextReplayCount,
            executionRequestId,
            now,
            now.plusSeconds(ATTEMPT_TIMEOUT_SECONDS))
        .then(workerGateway.execute(request))
        .flatMap(result -> completeReplay(
            candidate.workflow().workflowId(),
            nextAttemptNo,
            candidate.events(),
            result))
        .thenReturn(1);
  }

  private Mono<Void> completeReplay(
      String workflowId,
      int attemptNo,
      List<SemanticEvent> existingEvents,
      WorkerExecutionResult result) {
    long nextSequence = existingEvents.isEmpty()
        ? 1
        : existingEvents.getLast().sequence() + 1;
    List<SemanticEvent> replayEvents = new ArrayList<>();
    if (result.status() == WorkerExecutionStatus.SUCCEEDED) {
      replayEvents.add(new SemanticEvent(
          "1.0",
          UUID.randomUUID().toString(),
          workflowId,
          nextSequence,
          OffsetDateTime.now(clock),
          SemanticEventType.WORKFLOW_COMPLETED,
          new WorkflowCompletedPayload(
              SemanticEventType.WORKFLOW_COMPLETED,
              result.outputSchemaId(),
              result.output())));
    } else {
      replayEvents.add(new SemanticEvent(
          "1.0",
          UUID.randomUUID().toString(),
          workflowId,
          nextSequence,
          OffsetDateTime.now(clock),
          SemanticEventType.WORKFLOW_FAILED,
          new WorkflowFailedPayload(
              SemanticEventType.WORKFLOW_FAILED,
              result.errorCode() == null ? "WORKER_FAILED" : result.errorCode(),
              result.errorMessage() == null ? "worker execution failed" : result.errorMessage())));
    }
    StoredWorkflowStatus status = result.status() == WorkerExecutionStatus.SUCCEEDED
        ? StoredWorkflowStatus.SUCCEEDED
        : (retryableFailureClassifier.isRetryable(result)
            ? StoredWorkflowStatus.FAILED_RETRYABLE
            : StoredWorkflowStatus.FAILED_TERMINAL);
    boolean retryable = status == StoredWorkflowStatus.FAILED_RETRYABLE;
    return Flux.fromIterable(replayEvents)
        .concatMap(event -> workflowStore.appendEvent(workflowId, event.sequence(), event))
        .then(workflowStore.markWorkflowCompleted(
            workflowId,
            status,
            result,
            attemptNo,
            retryable,
            result.completedAt()));
  }
}
