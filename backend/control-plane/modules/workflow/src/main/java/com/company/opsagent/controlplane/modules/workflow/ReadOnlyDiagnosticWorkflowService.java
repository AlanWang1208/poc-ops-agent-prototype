package com.company.opsagent.controlplane.modules.workflow;

import com.company.opsagent.contracts.events.SemanticEvent;
import com.company.opsagent.contracts.events.SemanticEventPayload;
import com.company.opsagent.contracts.events.SemanticEventType;
import com.company.opsagent.contracts.events.SkillRoutedPayload;
import com.company.opsagent.contracts.events.WorkerAcceptedPayload;
import com.company.opsagent.contracts.events.WorkflowCompletedPayload;
import com.company.opsagent.contracts.events.WorkflowFailedPayload;
import com.company.opsagent.contracts.events.WorkflowStartedPayload;
import com.company.opsagent.contracts.workflow.ReadOnlyCommandEnvelope;
import com.company.opsagent.contracts.workflow.SkillReference;
import com.company.opsagent.contracts.workflow.WorkerExecutionRequest;
import com.company.opsagent.contracts.workflow.WorkerExecutionResult;
import com.company.opsagent.contracts.workflow.WorkerExecutionStatus;
import com.company.opsagent.controlplane.modules.agentrouting.SkillRoutingCriteria;
import com.company.opsagent.controlplane.modules.agentrouting.SkillRoutingService;
import com.company.opsagent.controlplane.modules.skillregistry.SkillPublicationStatus;
import com.company.opsagent.controlplane.modules.skillregistry.SkillRiskLevel;
import java.time.Clock;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import reactor.core.publisher.Mono;

/**
 * P1 只读诊断垂直切片应用服务。
 *
 * <p>服务负责确定性路由、创建命令信封和语义事件，并通过 WorkerGateway 提交执行。
 */
public class ReadOnlyDiagnosticWorkflowService {

  private static final long ATTEMPT_TIMEOUT_SECONDS = 30L;

  private final SkillRoutingService skillRoutingService;
  private final WorkerGateway workerGateway;
  private final Clock clock;
  private final ReadOnlyWorkflowStore workflowStore;
  private final RetryableFailureClassifier retryableFailureClassifier;

  public ReadOnlyDiagnosticWorkflowService(
      SkillRoutingService skillRoutingService,
      WorkerGateway workerGateway,
      Clock clock,
      ReadOnlyWorkflowStore workflowStore,
      RetryableFailureClassifier retryableFailureClassifier) {
    this.skillRoutingService = skillRoutingService;
    this.workerGateway = workerGateway;
    this.clock = clock;
    this.workflowStore = workflowStore;
    this.retryableFailureClassifier = retryableFailureClassifier;
  }

  /**
   * 启动只读工作流并返回可审计的最终结果和事件序列。
   */
  public Mono<ReadOnlyWorkflowResult> execute(ReadOnlyWorkflowRequest request) {
    String parametersHash = parameterHash(request);
    return workflowStore.findByIdempotency(
            request.idempotencyKey(),
            request.operator().operatorId(),
            request.targetEnvironment(),
            request.skillId(),
            parametersHash)
        .flatMap(existing -> {
          if (existing.executionResult() != null) {
            return Mono.just(existing.toWorkflowResult());
          }
          return Mono.error(new IllegalStateException(
              "workflow is already in progress for idempotency key " + request.idempotencyKey()));
        })
        .switchIfEmpty(Mono.defer(() -> createAndExecuteWorkflow(request, parametersHash)));
  }

  private Mono<ReadOnlyWorkflowResult> createAndExecuteWorkflow(
      ReadOnlyWorkflowRequest request,
      String parametersHash) {
    var candidates = skillRoutingService.findCandidates(new SkillRoutingCriteria(
        request.skillId(),
        null,
        SkillRiskLevel.READ_ONLY,
        List.of(),
        List.of(),
        List.of(request.targetEnvironment()),
        SkillPublicationStatus.VALIDATED));
    if (candidates.isEmpty()) {
      return Mono.error(new IllegalArgumentException("no validated read-only skill candidate found"));
    }

    var selectedSkill = candidates.getFirst().skill().descriptor();
    String workflowId = UUID.randomUUID().toString();
    String commandId = UUID.randomUUID().toString();
    String executionRequestId = UUID.randomUUID().toString();
    OffsetDateTime now = OffsetDateTime.now(clock);
    var skillReference = new SkillReference(
        selectedSkill.skillId(),
        selectedSkill.version(),
        selectedSkill.skillId() + ":" + selectedSkill.version() + ":input",
        selectedSkill.skillId() + ":" + selectedSkill.version() + ":output");
    var command = new ReadOnlyCommandEnvelope(
        "1.0",
        commandId,
        workflowId,
        request.idempotencyKey(),
        "READ_ONLY",
        request.targetEnvironment(),
        skillReference,
        request.parameters(),
        request.operator(),
        request.policyDecision(),
        request.trace(),
        now);
    var workerRequest = new WorkerExecutionRequest(
        "1.0",
        executionRequestId,
        now,
        now.plusSeconds(ATTEMPT_TIMEOUT_SECONDS),
        command);

    List<SemanticEvent> initialEvents = new ArrayList<>();
    initialEvents.add(event(workflowId, 1, SemanticEventType.WORKFLOW_STARTED,
        new WorkflowStartedPayload(SemanticEventType.WORKFLOW_STARTED, commandId, request.operator().operatorId())));
    initialEvents.add(event(workflowId, 2, SemanticEventType.SKILL_ROUTED,
        new SkillRoutedPayload(SemanticEventType.SKILL_ROUTED, selectedSkill.skillId(), selectedSkill.version())));
    initialEvents.add(event(workflowId, 3, SemanticEventType.WORKER_ACCEPTED,
        new WorkerAcceptedPayload(SemanticEventType.WORKER_ACCEPTED, executionRequestId)));

    return workflowStore.createWorkflow(
            workflowId,
            request.idempotencyKey(),
            request.operator().operatorId(),
            request.targetEnvironment(),
            selectedSkill.skillId(),
            selectedSkill.version(),
            parametersHash,
            request.policyDecision().decisionId(),
            request.policyDecision().policyVersion(),
            request.trace().traceId(),
            request.trace().requestId(),
            commandId,
            command,
            now)
        .then(workflowStore.startAttempt(
            workflowId,
            1,
            executionRequestId,
            StoredWorkflowAttemptKind.INITIAL,
            now,
            now.plusSeconds(ATTEMPT_TIMEOUT_SECONDS)))
        .then(appendEvents(workflowId, initialEvents))
        .then(workerGateway.execute(workerRequest))
        .flatMap(result -> complete(workflowId, 1, initialEvents, result));
  }

  private Mono<ReadOnlyWorkflowResult> complete(
      String workflowId,
      int attemptNo,
      List<SemanticEvent> initialEvents,
      WorkerExecutionResult result) {
    List<SemanticEvent> events = new ArrayList<>(initialEvents);
    StoredWorkflowStatus storedStatus;
    boolean retryable = false;
    if (result.status() == WorkerExecutionStatus.SUCCEEDED) {
      storedStatus = StoredWorkflowStatus.SUCCEEDED;
      events.add(event(workflowId, 4, SemanticEventType.WORKFLOW_COMPLETED,
          new WorkflowCompletedPayload(SemanticEventType.WORKFLOW_COMPLETED, result.outputSchemaId(), result.output())));
    } else {
      retryable = retryableFailureClassifier.isRetryable(result);
      storedStatus = retryable
          ? StoredWorkflowStatus.FAILED_RETRYABLE
          : StoredWorkflowStatus.FAILED_TERMINAL;
      events.add(event(workflowId, 4, SemanticEventType.WORKFLOW_FAILED,
          new WorkflowFailedPayload(
              SemanticEventType.WORKFLOW_FAILED,
              result.errorCode() == null ? "WORKER_FAILED" : result.errorCode(),
              result.errorMessage() == null ? "worker execution failed" : result.errorMessage())));
    }
    return appendEvents(workflowId, events.subList(initialEvents.size(), events.size()))
        .then(workflowStore.markWorkflowCompleted(
            workflowId,
            storedStatus,
            result,
            attemptNo,
            retryable,
            result.completedAt()))
        .thenReturn(new ReadOnlyWorkflowResult(workflowId, result, events));
  }

  private SemanticEvent event(
      String workflowId,
      long sequence,
      SemanticEventType type,
      SemanticEventPayload payload) {
    return new SemanticEvent(
        "1.0",
        UUID.randomUUID().toString(),
        workflowId,
        sequence,
        OffsetDateTime.now(clock),
        type,
        payload);
  }

  private Mono<Void> appendEvents(String workflowId, List<SemanticEvent> events) {
    return reactor.core.publisher.Flux.fromIterable(events)
        .concatMap(event -> workflowStore.appendEvent(workflowId, event.sequence(), event))
        .then();
  }

  private String parameterHash(ReadOnlyWorkflowRequest request) {
    return request.parameters().toString();
  }
}
