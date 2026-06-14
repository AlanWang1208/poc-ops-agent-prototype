package com.company.opsagent.controlplane.modules.workflow;

import static org.junit.jupiter.api.Assertions.assertEquals;

import java.time.OffsetDateTime;
import org.junit.jupiter.api.Test;
import reactor.test.StepVerifier;

/**
 * Agent workflow facts source tests.
 */
class AgentWorkflowStoreTest {

  @Test
  void storeReusesWorkflowByWorkspaceOperatorEnvironmentAndIdempotencyKey() {
    AgentWorkflowStore store = new InMemoryAgentWorkflowStore();
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
  void storeAppendsToolStepsWithMonotonicSequence() {
    AgentWorkflowStore store = new InMemoryAgentWorkflowStore();
    OffsetDateTime now = OffsetDateTime.parse("2026-06-13T12:00:00Z");

    StepVerifier.create(store.createOrReuse(
            "workflow-1",
            "workspace-default",
            "operator-1",
            "development",
            "idempotency-1",
            now)
        .then(store.appendToolStep(new StoredAgentToolStep(
            "workflow-1",
            "workspace-default",
            1,
            "tool-call-1",
            "node-health",
            "1.0.0",
            "sha256:first",
            "decision-1",
            StoredWorkflowStatus.RUNNING,
            now,
            null,
            null,
            null)))
        .then(store.appendToolStep(new StoredAgentToolStep(
            "workflow-1",
            "workspace-default",
            2,
            "tool-call-2",
            "platform-alert-summary",
            "1.0.0",
            "sha256:second",
            "decision-2",
            StoredWorkflowStatus.RUNNING,
            now.plusSeconds(1),
            null,
            null,
            null)))
        .thenMany(store.findToolStepsAfter("workspace-default", "workflow-1", 1)))
        .assertNext(step -> {
          assertEquals(2, step.stepSequence());
          assertEquals("tool-call-2", step.toolCallId());
        })
        .verifyComplete();
  }
}
