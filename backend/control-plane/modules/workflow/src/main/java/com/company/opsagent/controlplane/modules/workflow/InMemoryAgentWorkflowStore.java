package com.company.opsagent.controlplane.modules.workflow;

import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

/**
 * 面向 POC 和单元测试的内存版 Agent workflow 事实源。
 */
public class InMemoryAgentWorkflowStore implements AgentWorkflowStore {

  private final Map<String, StoredAgentWorkflow> workflowsById = new HashMap<>();
  private final Map<String, String> workflowIdsByIdempotency = new HashMap<>();
  private final Map<String, List<StoredAgentToolStep>> toolStepsByWorkflowId = new HashMap<>();

  @Override
  public Mono<StoredAgentWorkflow> createOrReuse(
      String workflowId,
      String workspaceId,
      String operatorId,
      String targetEnvironment,
      String idempotencyKey,
      OffsetDateTime createdAt) {
    String idempotencyTuple = idempotencyTuple(workspaceId, operatorId, targetEnvironment, idempotencyKey);
    String existingWorkflowId = workflowIdsByIdempotency.get(idempotencyTuple);
    if (existingWorkflowId != null) {
      return Mono.just(workflowsById.get(existingWorkflowId));
    }
    StoredAgentWorkflow workflow = new StoredAgentWorkflow(
        workflowId,
        workspaceId,
        operatorId,
        targetEnvironment,
        idempotencyKey,
        StoredWorkflowStatus.PENDING,
        createdAt,
        createdAt,
        null,
        null,
        null,
        null);
    workflowsById.put(workflowId, workflow);
    workflowIdsByIdempotency.put(idempotencyTuple, workflowId);
    toolStepsByWorkflowId.put(workflowId, new ArrayList<>());
    return Mono.just(workflow);
  }

  @Override
  public Mono<Void> appendToolStep(StoredAgentToolStep step) {
    List<StoredAgentToolStep> steps = toolStepsByWorkflowId.computeIfAbsent(step.workflowId(), key -> new ArrayList<>());
    boolean duplicateSequence = steps.stream().anyMatch(existing -> existing.stepSequence() == step.stepSequence());
    if (duplicateSequence) {
      return Mono.error(new IllegalArgumentException("agent tool step sequence already exists"));
    }
    steps.add(step);
    StoredAgentWorkflow workflow = workflowsById.get(step.workflowId());
    if (workflow != null && workflow.status() == StoredWorkflowStatus.PENDING) {
      workflowsById.put(step.workflowId(), workflow.withStatus(StoredWorkflowStatus.RUNNING, step.requestedAt(), null));
    }
    return Mono.empty();
  }

  @Override
  public Mono<Void> markToolStepCompleted(
      String workspaceId,
      String workflowId,
      long stepSequence,
      StoredWorkflowStatus status,
      String errorCode,
      String errorMessage,
      OffsetDateTime completedAt) {
    List<StoredAgentToolStep> steps = toolStepsByWorkflowId.getOrDefault(workflowId, List.of());
    for (int index = 0; index < steps.size(); index++) {
      StoredAgentToolStep step = steps.get(index);
      if (step.workspaceId().equals(workspaceId) && step.stepSequence() == stepSequence) {
        steps.set(index, step.completed(status, errorCode, errorMessage, completedAt));
        return Mono.empty();
      }
    }
    return Mono.error(new IllegalArgumentException("agent tool step not found"));
  }

  @Override
  public Mono<Void> markWorkflowCompleted(
      String workspaceId,
      String workflowId,
      StoredWorkflowStatus status,
      String resultStatus,
      String resultSummary,
      int resultToolCallCount,
      OffsetDateTime completedAt) {
    StoredAgentWorkflow workflow = workflowsById.get(workflowId);
    if (workflow == null || !workflow.workspaceId().equals(workspaceId)) {
      return Mono.error(new IllegalArgumentException("agent workflow not found"));
    }
    workflowsById.put(workflowId, workflow.withResult(
        status,
        completedAt,
        completedAt,
        resultStatus,
        resultSummary,
        resultToolCallCount));
    return Mono.empty();
  }

  @Override
  public Flux<StoredAgentToolStep> findToolStepsAfter(String workspaceId, String workflowId, long afterSequence) {
    return Flux.fromIterable(toolStepsByWorkflowId.getOrDefault(workflowId, List.of()).stream()
        .filter(step -> step.workspaceId().equals(workspaceId))
        .filter(step -> step.stepSequence() > afterSequence)
        .sorted(Comparator.comparingLong(StoredAgentToolStep::stepSequence))
        .toList());
  }

  private String idempotencyTuple(
      String workspaceId,
      String operatorId,
      String targetEnvironment,
      String idempotencyKey) {
    return workspaceId + ":" + operatorId + ":" + targetEnvironment + ":" + idempotencyKey;
  }
}
