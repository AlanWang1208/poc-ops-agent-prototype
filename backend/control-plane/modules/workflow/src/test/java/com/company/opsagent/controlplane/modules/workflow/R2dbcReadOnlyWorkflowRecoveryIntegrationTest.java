package com.company.opsagent.controlplane.modules.workflow;

import static org.junit.jupiter.api.Assertions.assertEquals;

import com.company.opsagent.contracts.workflow.OperatorContext;
import com.company.opsagent.contracts.workflow.PolicyDecisionReference;
import com.company.opsagent.contracts.workflow.ReadOnlyCommandEnvelope;
import com.company.opsagent.contracts.workflow.SkillReference;
import com.company.opsagent.contracts.workflow.TraceContext;
import com.company.opsagent.contracts.workflow.WorkerExecutionResult;
import com.company.opsagent.contracts.workflow.WorkerExecutionStatus;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.r2dbc.spi.ConnectionFactories;
import java.time.Clock;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.core.io.ClassPathResource;
import org.springframework.r2dbc.connection.init.ConnectionFactoryInitializer;
import org.springframework.r2dbc.connection.init.ResourceDatabasePopulator;
import org.springframework.r2dbc.core.DatabaseClient;
import reactor.core.publisher.Mono;
import reactor.test.StepVerifier;

/**
 * 验证真实 R2DBC 事实源下的恢复语义。
 *
 * <p>该测试覆盖过期运行中工作流从数据库回读、启动恢复和重放完成的完整路径。
 */
class R2dbcReadOnlyWorkflowRecoveryIntegrationTest {

  @Test
  void recoversExpiredRunningWorkflowFromPersistentStore() {
    ObjectMapper objectMapper = new ObjectMapper();
    OffsetDateTime createdAt = OffsetDateTime.parse("2026-06-07T01:00:00Z");
    Clock recoveryClock = Clock.fixed(Instant.parse("2026-06-07T01:02:00Z"), ZoneOffset.UTC);
    var store = testStore();
    var command = new ReadOnlyCommandEnvelope(
        "1.0",
        "command-1",
        "workflow-1",
        "idempotency-1",
        "READ_ONLY",
        "development",
        new SkillReference(
            "node-health-read",
            "1.1.0",
            "node-health-read:1.1.0:input",
            "node-health-read:1.1.0:output"),
        objectMapper.createObjectNode().put("nodeName", "node-a"),
        new OperatorContext("operator-1", List.of("ROLE_ops-reader")),
        new PolicyDecisionReference("decision-1", "policy-v1", "ALLOW"),
        new TraceContext("trace-1", "request-1"),
        createdAt);

    StepVerifier.create(store.createWorkflow(
            "workflow-1",
            "idempotency-1",
            "operator-1",
            "development",
            "node-health-read",
            "1.1.0",
            "sha256:abc",
            "decision-1",
            "policy-v1",
            "trace-1",
            "request-1",
            "command-1",
            command,
            createdAt)
        .then(store.startAttempt(
            "workflow-1",
            1,
            "execution-1",
            StoredWorkflowAttemptKind.INITIAL,
            createdAt,
            createdAt.plusSeconds(30))))
        .verifyComplete();

    var recoveryService = new ReadOnlyWorkflowRecoveryService(
        store,
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
            OffsetDateTime.now(recoveryClock))),
        recoveryClock,
        new RetryableFailureClassifier());

    StepVerifier.create(recoveryService.recoverStaleWorkflows()
            .then(store.findByIdempotency(
                "idempotency-1",
                "operator-1",
                "development",
                "node-health-read",
                "sha256:abc")))
        .assertNext(view -> {
          assertEquals(StoredWorkflowStatus.SUCCEEDED, view.workflow().status());
          assertEquals(2, view.workflow().currentAttemptNo());
          assertEquals(1, view.workflow().replayCount());
          assertEquals(2, view.attempts().size());
          assertEquals(StoredWorkflowAttemptKind.REPLAY, view.attempts().getLast().attemptKind());
          assertEquals(StoredWorkflowStatus.SUCCEEDED, view.attempts().getLast().status());
        })
        .verifyComplete();
  }

  private R2dbcReadOnlyWorkflowStore testStore() {
    var connectionFactory = ConnectionFactories.get(
        "r2dbc:h2:mem:///workflow-recovery-" + System.nanoTime() + ";DB_CLOSE_DELAY=-1");
    var initializer = new ConnectionFactoryInitializer();
    initializer.setConnectionFactory(connectionFactory);
    initializer.setDatabasePopulator(new ResourceDatabasePopulator(
        new ClassPathResource("sql/migrations/V001__workflow_schema.sql")));
    initializer.afterPropertiesSet();
    return new R2dbcReadOnlyWorkflowStore(DatabaseClient.create(connectionFactory), new ObjectMapper());
  }
}
