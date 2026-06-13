package com.company.opsagent.controlplane.modules.workflow;

import com.company.opsagent.contracts.events.SemanticEvent;
import com.company.opsagent.contracts.workflow.ReadOnlyCommandEnvelope;
import com.company.opsagent.contracts.workflow.WorkerExecutionResult;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

/**
 * 面向单元测试的内存版只读工作流存储。
 *
 * <p>该夹具模拟工作流实例、执行尝试与事件事实源，确保恢复语义测试不依赖真实数据库。
 */
class InMemoryReadOnlyWorkflowStoreFixture implements ReadOnlyWorkflowStore {

  private final Map<String, StoredReadOnlyWorkflow> workflowsById = new HashMap<>();
  private final Map<String, String> workflowIdsByIdempotency = new HashMap<>();
  private final Map<String, WorkerExecutionResult> resultsByWorkflowId = new HashMap<>();
  private final Map<String, List<SemanticEvent>> eventsByWorkflowId = new HashMap<>();
  private final Map<String, List<StoredWorkflowAttempt>> attemptsByWorkflowId = new HashMap<>();
  private final Map<String, ReadOnlyCommandEnvelope> commandsByWorkflowId = new HashMap<>();

  @Override
  public Mono<Void> createWorkflow(
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
      OffsetDateTime createdAt) {
    workflowsById.put(workflowId, new StoredReadOnlyWorkflow(
        workflowId,
        idempotencyKey,
        operatorId,
        targetEnvironment,
        skillId,
        skillVersion,
        parametersHash,
        StoredWorkflowStatus.PENDING,
        policyDecisionId,
        policyVersion,
        traceId,
        requestId,
        commandId,
        command.toString(),
        0,
        1,
        0,
        null,
        null,
        null,
        null,
        null,
        createdAt,
        createdAt,
        null));
    workflowIdsByIdempotency.put(idempotencyKey, workflowId);
    eventsByWorkflowId.put(workflowId, new ArrayList<>());
    attemptsByWorkflowId.put(workflowId, new ArrayList<>());
    commandsByWorkflowId.put(workflowId, command);
    return Mono.empty();
  }

  @Override
  public Mono<PersistedReadOnlyWorkflowView> findByIdempotency(
      String idempotencyKey,
      String operatorId,
      String targetEnvironment,
      String skillId,
      String parametersHash) {
    String workflowId = workflowIdsByIdempotency.get(idempotencyKey);
    if (workflowId == null) {
      return Mono.empty();
    }
    return Mono.just(new PersistedReadOnlyWorkflowView(
        workflowsById.get(workflowId),
        commandsByWorkflowId.get(workflowId),
        resultsByWorkflowId.get(workflowId),
        attemptsByWorkflowId(workflowId),
        eventsByWorkflowId(workflowId)));
  }

  @Override
  public Flux<SemanticEvent> loadEventsAfter(String workflowId, long afterSequence) {
    return Flux.fromIterable(eventsByWorkflowId(workflowId).stream()
        .filter(event -> event.sequence() > afterSequence)
        .sorted(Comparator.comparingLong(SemanticEvent::sequence))
        .toList());
  }

  @Override
  public Mono<Void> appendEvent(String workflowId, long sequence, SemanticEvent event) {
    eventsByWorkflowId.computeIfAbsent(workflowId, key -> new ArrayList<>()).add(event);
    return Mono.empty();
  }

  @Override
  public Mono<Void> startAttempt(
      String workflowId,
      int attemptNo,
      String executionRequestId,
      StoredWorkflowAttemptKind attemptKind,
      OffsetDateTime startedAt,
      OffsetDateTime expiresAt) {
    attemptsByWorkflowId.computeIfAbsent(workflowId, key -> new ArrayList<>()).add(new StoredWorkflowAttempt(
        workflowId,
        attemptNo,
        executionRequestId,
        attemptKind,
        attemptKind == StoredWorkflowAttemptKind.INITIAL
            ? StoredWorkflowStatus.RUNNING
            : StoredWorkflowStatus.REPLAYING,
        startedAt,
        null,
        expiresAt,
        null,
        null,
        false));
    updateWorkflowForAttempt(
        workflowId,
        attemptNo,
        attemptKind == StoredWorkflowAttemptKind.INITIAL
            ? StoredWorkflowStatus.RUNNING
            : StoredWorkflowStatus.REPLAYING,
        startedAt,
        null);
    return Mono.empty();
  }

  @Override
  public Mono<Void> markWorkflowCompleted(
      String workflowId,
      StoredWorkflowStatus status,
      WorkerExecutionResult result,
      int attemptNo,
      boolean retryable,
      OffsetDateTime completedAt) {
    StoredReadOnlyWorkflow workflow = workflowsById.get(workflowId);
    workflowsById.put(workflowId, new StoredReadOnlyWorkflow(
        workflow.workflowId(),
        workflow.idempotencyKey(),
        workflow.operatorId(),
        workflow.targetEnvironment(),
        workflow.skillId(),
        workflow.skillVersion(),
        workflow.parametersHash(),
        status,
        workflow.policyDecisionId(),
        workflow.policyVersion(),
        workflow.traceId(),
        workflow.requestId(),
        workflow.commandId(),
        workflow.commandJson(),
        attemptNo,
        workflow.maxReplayCount(),
        workflow.replayCount(),
        result.status().name(),
        result.outputSchemaId(),
        result.output() == null ? null : result.output().toString(),
        result.errorCode(),
        result.errorMessage(),
        workflow.createdAt(),
        completedAt,
        completedAt));
    List<StoredWorkflowAttempt> attempts = attemptsByWorkflowId.computeIfAbsent(workflowId, key -> new ArrayList<>());
    for (int index = 0; index < attempts.size(); index++) {
      StoredWorkflowAttempt attempt = attempts.get(index);
      if (attempt.attemptNo() == attemptNo) {
        attempts.set(index, new StoredWorkflowAttempt(
            attempt.workflowId(),
            attempt.attemptNo(),
            attempt.executionRequestId(),
            attempt.attemptKind(),
            status,
            attempt.startedAt(),
            completedAt,
            attempt.expiresAt(),
            result.errorCode(),
            result.errorMessage(),
            retryable));
      }
    }
    resultsByWorkflowId.put(workflowId, result);
    return Mono.empty();
  }

  /**
   * 预置一个已成功完成的工作流，用于验证幂等命中路径。
   */
  void seedSucceededWorkflow(
      String workflowId,
      String idempotencyKey,
      WorkerExecutionResult result,
      List<SemanticEvent> events) {
    OffsetDateTime now = result.completedAt();
    workflowsById.put(workflowId, new StoredReadOnlyWorkflow(
        workflowId,
        idempotencyKey,
        "operator-1",
        "development",
        "node-health-read",
        "1.1.0",
        "seed",
        StoredWorkflowStatus.SUCCEEDED,
        "decision-1",
        "policy-v1",
        "trace-1",
        "request-1",
        result.commandId(),
        defaultCommand(workflowId, idempotencyKey).toString(),
        1,
        1,
        0,
        result.status().name(),
        result.outputSchemaId(),
        result.output() == null ? null : result.output().toString(),
        result.errorCode(),
        result.errorMessage(),
        now.minusMinutes(1),
        now,
        now));
    workflowIdsByIdempotency.put(idempotencyKey, workflowId);
    commandsByWorkflowId.put(workflowId, defaultCommand(workflowId, idempotencyKey));
    resultsByWorkflowId.put(workflowId, result);
    eventsByWorkflowId.put(workflowId, new ArrayList<>(events));
    attemptsByWorkflowId.put(workflowId, new ArrayList<>(List.of(new StoredWorkflowAttempt(
        workflowId,
        1,
        result.executionRequestId(),
        StoredWorkflowAttemptKind.INITIAL,
        StoredWorkflowStatus.SUCCEEDED,
        now.minusMinutes(1),
        now,
        now.minusSeconds(30),
        result.errorCode(),
        result.errorMessage(),
        false))));
  }

  /**
   * 预置一个允许重放的失败工作流。
   */
  void seedRetryableFailure(
      String workflowId,
      String idempotencyKey,
      ReadOnlyCommandEnvelope command,
      WorkerExecutionResult result,
      int replayCount,
      int maxReplayCount) {
    OffsetDateTime now = result.completedAt();
    workflowsById.put(workflowId, new StoredReadOnlyWorkflow(
        workflowId,
        idempotencyKey,
        "operator-1",
        "development",
        "node-health-read",
        "1.1.0",
        "seed",
        StoredWorkflowStatus.FAILED_RETRYABLE,
        "decision-1",
        "policy-v1",
        "trace-1",
        "request-1",
        result.commandId(),
        command.toString(),
        1,
        maxReplayCount,
        replayCount,
        result.status().name(),
        result.outputSchemaId(),
        result.output() == null ? null : result.output().toString(),
        result.errorCode(),
        result.errorMessage(),
        now.minusMinutes(2),
        now.minusMinutes(2),
        now));
    workflowIdsByIdempotency.put(idempotencyKey, workflowId);
    commandsByWorkflowId.put(workflowId, command);
    resultsByWorkflowId.put(workflowId, result);
    eventsByWorkflowId.put(workflowId, new ArrayList<>());
    attemptsByWorkflowId.put(workflowId, new ArrayList<>(List.of(new StoredWorkflowAttempt(
        workflowId,
        1,
        result.executionRequestId(),
        StoredWorkflowAttemptKind.INITIAL,
        StoredWorkflowStatus.FAILED_RETRYABLE,
        now.minusMinutes(3),
        now,
        now.minusMinutes(2),
        result.errorCode(),
        result.errorMessage(),
        true))));
  }

  /**
   * 预置一个已接受但迟迟未完成的运行中工作流，用于验证过期恢复。
   */
  void seedRunningWorkflow(
      String workflowId,
      String idempotencyKey,
      ReadOnlyCommandEnvelope command,
      String executionRequestId,
      OffsetDateTime startedAt,
      OffsetDateTime expiresAt) {
    workflowsById.put(workflowId, new StoredReadOnlyWorkflow(
        workflowId,
        idempotencyKey,
        "operator-1",
        "development",
        "node-health-read",
        "1.1.0",
        "seed",
        StoredWorkflowStatus.RUNNING,
        "decision-1",
        "policy-v1",
        "trace-1",
        "request-1",
        command.commandId(),
        command.toString(),
        1,
        1,
        0,
        null,
        null,
        null,
        null,
        null,
        startedAt.minusSeconds(1),
        startedAt,
        null));
    workflowIdsByIdempotency.put(idempotencyKey, workflowId);
    commandsByWorkflowId.put(workflowId, command);
    resultsByWorkflowId.remove(workflowId);
    eventsByWorkflowId.put(workflowId, new ArrayList<>());
    attemptsByWorkflowId.put(workflowId, new ArrayList<>(List.of(new StoredWorkflowAttempt(
        workflowId,
        1,
        executionRequestId,
        StoredWorkflowAttemptKind.INITIAL,
        StoredWorkflowStatus.RUNNING,
        startedAt,
        null,
        expiresAt,
        null,
        null,
        false))));
  }

  StoredReadOnlyWorkflow workflowByIdempotency(String idempotencyKey) {
    return workflowsById.get(workflowIdsByIdempotency.get(idempotencyKey));
  }

  StoredReadOnlyWorkflow workflowById(String workflowId) {
    return workflowsById.get(workflowId);
  }

  List<SemanticEvent> eventsByIdempotency(String idempotencyKey) {
    return List.copyOf(eventsByWorkflowId.get(workflowIdsByIdempotency.get(idempotencyKey)));
  }

  List<SemanticEvent> eventsByWorkflowId(String workflowId) {
    return List.copyOf(eventsByWorkflowId.getOrDefault(workflowId, List.of()));
  }

  List<StoredWorkflowAttempt> attemptsByWorkflowId(String workflowId) {
    return List.copyOf(attemptsByWorkflowId.getOrDefault(workflowId, List.of()));
  }

  @Override
  public Flux<PersistedReadOnlyWorkflowView> findReplayCandidates(OffsetDateTime updatedBefore) {
    return Flux.fromIterable(workflowsById.values().stream()
            .filter(workflow -> workflow.replayCount() < workflow.maxReplayCount())
            .filter(workflow -> isReplayCandidate(workflow, updatedBefore))
            .sorted(Comparator.comparing(StoredReadOnlyWorkflow::updatedAt))
            .toList())
        .map(workflow -> new PersistedReadOnlyWorkflowView(
            workflow,
            commandsByWorkflowId.get(workflow.workflowId()),
            resultsByWorkflowId.get(workflow.workflowId()),
            attemptsByWorkflowId(workflow.workflowId()),
            eventsByWorkflowId(workflow.workflowId())));
  }

  @Override
  public Mono<Void> markReplayStarted(
      String workflowId,
      int attemptNo,
      int replayCount,
      String executionRequestId,
      OffsetDateTime startedAt,
      OffsetDateTime expiresAt) {
    attemptsByWorkflowId.computeIfAbsent(workflowId, key -> new ArrayList<>()).add(new StoredWorkflowAttempt(
        workflowId,
        attemptNo,
        executionRequestId,
        StoredWorkflowAttemptKind.REPLAY,
        StoredWorkflowStatus.REPLAYING,
        startedAt,
        null,
        expiresAt,
        null,
        null,
        false));
    updateWorkflowForAttempt(workflowId, attemptNo, StoredWorkflowStatus.REPLAYING, startedAt, replayCount);
    resultsByWorkflowId.remove(workflowId);
    return Mono.empty();
  }

  private boolean isReplayCandidate(StoredReadOnlyWorkflow workflow, OffsetDateTime updatedBefore) {
    if (workflow.status() == StoredWorkflowStatus.FAILED_RETRYABLE) {
      return !workflow.updatedAt().isAfter(updatedBefore);
    }
    if (workflow.status() != StoredWorkflowStatus.RUNNING
        && workflow.status() != StoredWorkflowStatus.REPLAYING) {
      return false;
    }
    return attemptsByWorkflowId(workflow.workflowId()).stream()
        .filter(attempt -> attempt.attemptNo() == workflow.currentAttemptNo())
        .map(StoredWorkflowAttempt::expiresAt)
        .filter(expiresAt -> expiresAt != null)
        .anyMatch(expiresAt -> !expiresAt.isAfter(updatedBefore));
  }

  /**
   * 共享的工作流主记录推进逻辑，用于模拟真实存储对当前尝试和终态结果的更新。
   */
  private void updateWorkflowForAttempt(
      String workflowId,
      int attemptNo,
      StoredWorkflowStatus status,
      OffsetDateTime updatedAt,
      Integer replayCount) {
    StoredReadOnlyWorkflow workflow = workflowsById.get(workflowId);
    workflowsById.put(workflowId, new StoredReadOnlyWorkflow(
        workflow.workflowId(),
        workflow.idempotencyKey(),
        workflow.operatorId(),
        workflow.targetEnvironment(),
        workflow.skillId(),
        workflow.skillVersion(),
        workflow.parametersHash(),
        status,
        workflow.policyDecisionId(),
        workflow.policyVersion(),
        workflow.traceId(),
        workflow.requestId(),
        workflow.commandId(),
        workflow.commandJson(),
        attemptNo,
        workflow.maxReplayCount(),
        replayCount == null ? workflow.replayCount() : replayCount,
        null,
        null,
        null,
        null,
        null,
        workflow.createdAt(),
        updatedAt,
        null));
  }

  private ReadOnlyCommandEnvelope defaultCommand(String workflowId, String idempotencyKey) {
    return new ReadOnlyCommandEnvelope(
        "1.0",
        "command-1",
        workflowId,
        idempotencyKey,
        "READ_ONLY",
        "development",
        new com.company.opsagent.contracts.workflow.SkillReference(
            "node-health-read",
            "1.1.0",
            "node-health-read:1.1.0:input",
            "node-health-read:1.1.0:output"),
        new com.fasterxml.jackson.databind.ObjectMapper().createObjectNode().put("nodeName", "node-a"),
        new com.company.opsagent.contracts.workflow.OperatorContext("operator-1", List.of("ROLE_ops-reader")),
        new com.company.opsagent.contracts.workflow.PolicyDecisionReference("decision-1", "policy-v1", "ALLOW"),
        new com.company.opsagent.contracts.workflow.TraceContext("trace-1", "request-1"),
        OffsetDateTime.parse("2026-06-06T15:00:00Z"));
  }
}
