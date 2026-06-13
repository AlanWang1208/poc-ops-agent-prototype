package com.company.opsagent.controlplane.modules.workflow;

import static org.junit.jupiter.api.Assertions.assertEquals;

import com.company.opsagent.contracts.events.SemanticEventType;
import com.company.opsagent.contracts.workflow.OperatorContext;
import com.company.opsagent.contracts.workflow.PolicyDecisionReference;
import com.company.opsagent.contracts.workflow.TraceContext;
import com.company.opsagent.contracts.workflow.WorkerExecutionResult;
import com.company.opsagent.contracts.workflow.WorkerExecutionStatus;
import com.company.opsagent.controlplane.modules.agentrouting.SkillRouteCandidate;
import com.company.opsagent.controlplane.modules.agentrouting.SkillRoutingService;
import com.company.opsagent.controlplane.modules.skillregistry.RegisteredSkill;
import com.company.opsagent.controlplane.modules.skillregistry.SkillCategory;
import com.company.opsagent.controlplane.modules.skillregistry.SkillDescriptor;
import com.company.opsagent.controlplane.modules.skillregistry.SkillExecutorType;
import com.company.opsagent.controlplane.modules.skillregistry.SkillOutputType;
import com.company.opsagent.controlplane.modules.skillregistry.SkillPublicationMetadata;
import com.company.opsagent.controlplane.modules.skillregistry.SkillPublicationStatus;
import com.company.opsagent.controlplane.modules.skillregistry.SkillReleaseSnapshot;
import com.company.opsagent.controlplane.modules.skillregistry.SkillReleaseStage;
import com.company.opsagent.controlplane.modules.skillregistry.SkillRiskLevel;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.time.Clock;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.List;
import org.junit.jupiter.api.Test;
import reactor.core.publisher.Mono;
import reactor.test.StepVerifier;

/**
 * 验证只读工作流完成路由、Worker 提交和强类型事件输出。
 */
class ReadOnlyDiagnosticWorkflowServiceTest {

  @Test
  void routesAndExecutesReadOnlySkill() {
    Clock clock = Clock.fixed(Instant.parse("2026-06-06T15:00:00Z"), ZoneOffset.UTC);
    ObjectMapper objectMapper = new ObjectMapper();
    RegisteredSkill skill = skill();
    SkillRoutingService routingService = criteria -> List.of(new SkillRouteCandidate(
        skill,
        new SkillReleaseSnapshot("node-health-read", "1.1.0", SkillReleaseStage.GENERAL_AVAILABLE,
            100, List.of(), "test", OffsetDateTime.now(clock)),
        100,
        List.of("test")));
    WorkerGateway gateway = request -> Mono.just(new WorkerExecutionResult(
        "1.0",
        request.executionRequestId(),
        request.command().commandId(),
        request.command().workflowId(),
        WorkerExecutionStatus.SUCCEEDED,
        request.command().skill().outputSchemaId(),
        objectMapper.createObjectNode().put("status", "HEALTHY"),
        null,
        null,
        OffsetDateTime.now(clock)));
    var store = new InMemoryReadOnlyWorkflowStoreFixture();
    var service = new ReadOnlyDiagnosticWorkflowService(
        routingService,
        gateway,
        clock,
        store,
        new RetryableFailureClassifier());
    var request = new ReadOnlyWorkflowRequest(
        "node-health-read",
        "development",
        "idempotency-1",
        objectMapper.createObjectNode().put("nodeName", "node-a"),
        new OperatorContext("operator-1", List.of("ROLE_ops-reader")),
        new PolicyDecisionReference("decision-1", "policy-v1", "ALLOW"),
        new TraceContext("trace-1", "request-1"));

    StepVerifier.create(service.execute(request))
        .assertNext(result -> {
          assertEquals(WorkerExecutionStatus.SUCCEEDED, result.executionResult().status());
          assertEquals(List.of(
              SemanticEventType.WORKFLOW_STARTED,
              SemanticEventType.SKILL_ROUTED,
              SemanticEventType.WORKER_ACCEPTED,
              SemanticEventType.WORKFLOW_COMPLETED), result.events().stream().map(event -> event.type()).toList());
        })
        .verifyComplete();
  }

  @Test
  void returnsPersistedWorkflowWhenIdempotencyTupleAlreadySucceeded() {
    Clock clock = Clock.fixed(Instant.parse("2026-06-06T15:00:00Z"), ZoneOffset.UTC);
    ObjectMapper objectMapper = new ObjectMapper();
    var store = new InMemoryReadOnlyWorkflowStoreFixture();
    var persistedResult = new WorkerExecutionResult(
        "1.0",
        "execution-1",
        "command-1",
        "workflow-1",
        WorkerExecutionStatus.SUCCEEDED,
        "node-health-read:1.1.0:output",
        objectMapper.createObjectNode().put("status", "HEALTHY"),
        null,
        null,
        OffsetDateTime.now(clock));
    store.seedSucceededWorkflow(
        "workflow-1",
        "idempotency-1",
        persistedResult,
        List.of());
    var service = new ReadOnlyDiagnosticWorkflowService(
        routingService(clock),
        request -> Mono.error(new AssertionError("worker gateway should not be invoked")),
        clock,
        store,
        new RetryableFailureClassifier());

    StepVerifier.create(service.execute(request(objectMapper, "idempotency-1")))
        .assertNext(result -> assertEquals("workflow-1", result.workflowId()))
        .verifyComplete();
  }

  @Test
  void persistsCreatedWorkflowAndCompletionEvents() {
    Clock clock = Clock.fixed(Instant.parse("2026-06-06T15:00:00Z"), ZoneOffset.UTC);
    ObjectMapper objectMapper = new ObjectMapper();
    var store = new InMemoryReadOnlyWorkflowStoreFixture();
    var service = new ReadOnlyDiagnosticWorkflowService(
        routingService(clock),
        request -> Mono.just(new WorkerExecutionResult(
            "1.0",
            request.executionRequestId(),
            request.command().commandId(),
            request.command().workflowId(),
            WorkerExecutionStatus.SUCCEEDED,
            request.command().skill().outputSchemaId(),
            objectMapper.createObjectNode().put("status", "HEALTHY"),
            null,
            null,
            OffsetDateTime.now(clock))),
        clock,
        store,
        new RetryableFailureClassifier());

    StepVerifier.create(service.execute(request(objectMapper, "idempotency-2")))
        .assertNext(result -> {
          assertEquals(StoredWorkflowStatus.SUCCEEDED, store.workflowByIdempotency("idempotency-2").status());
          assertEquals(4, store.eventsByIdempotency("idempotency-2").size());
        })
        .verifyComplete();
  }

  @Test
  void marksRetryableFailureWhenWorkerTimeoutOccurs() {
    Clock clock = Clock.fixed(Instant.parse("2026-06-06T15:00:00Z"), ZoneOffset.UTC);
    ObjectMapper objectMapper = new ObjectMapper();
    var store = new InMemoryReadOnlyWorkflowStoreFixture();
    var service = new ReadOnlyDiagnosticWorkflowService(
        routingService(clock),
        request -> Mono.just(new WorkerExecutionResult(
            "1.0",
            request.executionRequestId(),
            request.command().commandId(),
            request.command().workflowId(),
            WorkerExecutionStatus.FAILED,
            request.command().skill().outputSchemaId(),
            objectMapper.nullNode(),
            "WORKER_TIMEOUT",
            "worker execution timed out",
            OffsetDateTime.now(clock))),
        clock,
        store,
        new RetryableFailureClassifier());

    StepVerifier.create(service.execute(request(objectMapper, "idempotency-3")))
        .assertNext(result -> {
          assertEquals(StoredWorkflowStatus.FAILED_RETRYABLE, store.workflowByIdempotency("idempotency-3").status());
          assertEquals(SemanticEventType.WORKFLOW_FAILED, store.eventsByIdempotency("idempotency-3").getLast().type());
        })
        .verifyComplete();
  }

  private SkillRoutingService routingService(Clock clock) {
    RegisteredSkill skill = skill();
    return criteria -> List.of(new SkillRouteCandidate(
        skill,
        new SkillReleaseSnapshot("node-health-read", "1.1.0", SkillReleaseStage.GENERAL_AVAILABLE,
            100, List.of(), "test", OffsetDateTime.now(clock)),
        100,
        List.of("test")));
  }

  private ReadOnlyWorkflowRequest request(ObjectMapper objectMapper, String idempotencyKey) {
    return new ReadOnlyWorkflowRequest(
        "node-health-read",
        "development",
        idempotencyKey,
        objectMapper.createObjectNode().put("nodeName", "node-a"),
        new OperatorContext("operator-1", List.of("ROLE_ops-reader")),
        new PolicyDecisionReference("decision-1", "policy-v1", "ALLOW"),
        new TraceContext("trace-1", "request-1"));
  }

  private RegisteredSkill skill() {
    return new RegisteredSkill(
        new SkillDescriptor(
            "node-health-read",
            "1.1.0",
            "节点健康",
            "只读节点健康诊断",
            SkillCategory.INFRASTRUCTURE_DIAGNOSTICS,
            SkillRiskLevel.READ_ONLY,
            SkillExecutorType.HTTP,
            SkillOutputType.JSON,
            true,
            20,
            "platform-observability",
            List.of("ROLE_ops-reader"),
            List.of("node"),
            List.of(),
            List.of()),
        new SkillPublicationMetadata(
            "platform-observability",
            OffsetDateTime.parse("2026-06-06T15:00:00Z"),
            "checksum",
            "HmacSHA256",
            "signature"),
        SkillPublicationStatus.VALIDATED,
        "skills/node-health/manifest.json");
  }
}
