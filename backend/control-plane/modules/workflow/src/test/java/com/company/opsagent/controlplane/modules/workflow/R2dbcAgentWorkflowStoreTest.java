package com.company.opsagent.controlplane.modules.workflow;

import static org.junit.jupiter.api.Assertions.assertEquals;

import java.time.OffsetDateTime;
import org.junit.jupiter.api.Test;
import org.springframework.core.io.ClassPathResource;
import org.springframework.r2dbc.connection.init.ConnectionFactoryInitializer;
import org.springframework.r2dbc.connection.init.ResourceDatabasePopulator;
import org.springframework.r2dbc.core.DatabaseClient;
import io.r2dbc.spi.ConnectionFactories;
import reactor.test.StepVerifier;

class R2dbcAgentWorkflowStoreTest {

  @Test
  void createsOrReusesWorkflowByIdempotencyTuple() {
    var store = testStore();
    OffsetDateTime now = OffsetDateTime.parse("2026-06-13T12:00:00Z");

    StepVerifier.create(store.createOrReuse(
            "workflow-1",
            "workspace-default",
            "operator-1",
            "development",
            "idempotency-1",
            now)
        .then(store.createOrReuse(
            "workflow-2",
            "workspace-default",
            "operator-1",
            "development",
            "idempotency-1",
            now.plusSeconds(1))))
        .assertNext(workflow -> {
          assertEquals("workflow-1", workflow.workflowId());
          assertEquals(StoredWorkflowStatus.PENDING, workflow.status());
        })
        .verifyComplete();
  }

  @Test
  void appendsToolStepsAndFindsStepsAfterSequence() {
    var store = testStore();
    OffsetDateTime now = OffsetDateTime.parse("2026-06-13T12:00:00Z");

    StepVerifier.create(store.createOrReuse(
            "workflow-1",
            "workspace-default",
            "operator-1",
            "development",
            "idempotency-1",
            now)
        .then(store.appendToolStep(step("workflow-1", 1, "tool-call-1", "node-health-read", now)))
        .then(store.appendToolStep(step("workflow-1", 2, "tool-call-2", "application-log-summary-read", now.plusSeconds(1))))
        .thenMany(store.findToolStepsAfter("workspace-default", "workflow-1", 1)))
        .assertNext(step -> {
          assertEquals(2, step.stepSequence());
          assertEquals("tool-call-2", step.toolCallId());
        })
        .verifyComplete();
  }

  @Test
  void marksWorkflowAndToolStepCompleted() {
    var store = testStore();
    OffsetDateTime now = OffsetDateTime.parse("2026-06-13T12:00:00Z");

    StepVerifier.create(store.createOrReuse(
            "workflow-1",
            "workspace-default",
            "operator-1",
            "development",
            "idempotency-1",
            now)
        .then(store.appendToolStep(step("workflow-1", 1, "tool-call-1", "node-health-read", now)))
        .then(store.markToolStepCompleted(
            "workspace-default",
            "workflow-1",
            1,
            StoredWorkflowStatus.SUCCEEDED,
            null,
            null,
            now.plusSeconds(2)))
        .then(store.markWorkflowCompleted(
            "workspace-default",
            "workflow-1",
            StoredWorkflowStatus.SUCCEEDED,
            now.plusSeconds(3)))
        .thenMany(store.findToolStepsAfter("workspace-default", "workflow-1", 0)))
        .assertNext(step -> {
          assertEquals(StoredWorkflowStatus.SUCCEEDED, step.status());
          assertEquals(now.plusSeconds(2), step.completedAt());
        })
        .verifyComplete();
  }

  private StoredAgentToolStep step(
      String workflowId,
      long sequence,
      String toolCallId,
      String skillId,
      OffsetDateTime requestedAt) {
    return new StoredAgentToolStep(
        workflowId,
        "workspace-default",
        sequence,
        toolCallId,
        skillId,
        "1.0.0",
        "sha256:" + sequence,
        "decision-" + sequence,
        StoredWorkflowStatus.RUNNING,
        requestedAt,
        null,
        null,
        null);
  }

  private R2dbcAgentWorkflowStore testStore() {
    var connectionFactory = ConnectionFactories.get(
        "r2dbc:h2:mem:///agent-workflow-store-" + System.nanoTime() + ";DB_CLOSE_DELAY=-1");
    var initializer = new ConnectionFactoryInitializer();
    initializer.setConnectionFactory(connectionFactory);
    initializer.setDatabasePopulator(new ResourceDatabasePopulator(
        new ClassPathResource("sql/migrations/V002__agent_workflow_schema.sql")));
    initializer.afterPropertiesSet();
    return new R2dbcAgentWorkflowStore(DatabaseClient.create(connectionFactory));
  }
}
