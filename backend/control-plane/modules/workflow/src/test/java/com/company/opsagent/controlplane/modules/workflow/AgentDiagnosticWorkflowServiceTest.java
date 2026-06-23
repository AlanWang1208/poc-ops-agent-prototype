package com.company.opsagent.controlplane.modules.workflow;

import static org.junit.jupiter.api.Assertions.assertEquals;

import com.company.opsagent.contracts.agent.AgentTaskRequest;
import com.company.opsagent.contracts.workflow.OperatorContext;
import com.company.opsagent.contracts.workflow.PolicyDecisionReference;
import com.company.opsagent.contracts.workflow.TraceContext;
import com.company.opsagent.contracts.workflow.WorkspaceContext;
import com.company.opsagent.controlplane.modules.agentruntime.AgentRuntimeRequest;
import com.company.opsagent.controlplane.modules.agentruntime.AgentRuntimeResult;
import java.time.Clock;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Map;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.jupiter.api.Test;
import reactor.core.publisher.Mono;
import reactor.test.StepVerifier;

class AgentDiagnosticWorkflowServiceTest {

  @Test
  void executesAgentRuntimeInsidePersistedWorkflow() {
    Clock clock = fixedClock();
    var store = new InMemoryAgentWorkflowStore();
    var runtimeRequest = new AtomicReference<AgentRuntimeRequest>();
    var service = new AgentDiagnosticWorkflowService(
        request -> {
          runtimeRequest.set(request);
          return Mono.just(new AgentRuntimeResult("SUCCEEDED", "node-1 is healthy", 1));
        },
        store,
        clock);

    StepVerifier.create(service.execute(request("task-1", "idempotency-1")))
        .assertNext(result -> {
          assertEquals("task-1", result.taskId());
          assertEquals("SUCCEEDED", result.status());
          assertEquals("node-1 is healthy", result.summary());
          assertEquals(1, result.toolCallCount());
          assertEquals("workspace-default", runtimeRequest.get().workspaceId());
        })
        .verifyComplete();

    StepVerifier.create(store.createOrReuse(
            "workflow-other",
            "workspace-default",
            "operator-1",
            "development",
            "idempotency-1",
            OffsetDateTime.now(clock)))
        .assertNext(workflow -> assertEquals(StoredWorkflowStatus.SUCCEEDED, workflow.status()))
        .verifyComplete();
  }

  @Test
  void marksWorkflowFailedWhenAgentRuntimeFailsBeforeWorkerCall() {
    Clock clock = fixedClock();
    var store = new InMemoryAgentWorkflowStore();
    var service = new AgentDiagnosticWorkflowService(
        request -> Mono.error(new IllegalStateException("model provider unavailable with internal details")),
        store,
        clock);
    var workflowId = new AtomicReference<String>();

    StepVerifier.create(service.execute(request("task-2", "idempotency-2")))
        .assertNext(result -> {
          workflowId.set(result.workflowId());
          assertEquals("task-2", result.taskId());
          assertEquals("FAILED_TERMINAL", result.status());
          assertEquals("Agent runtime failed before a tool call could be completed.", result.summary());
          assertEquals(0, result.toolCallCount());
        })
        .verifyComplete();

    StepVerifier.create(store.createOrReuse(
            "workflow-other",
            "workspace-default",
            "operator-1",
            "development",
            "idempotency-2",
            OffsetDateTime.now(clock)))
        .assertNext(workflow -> assertEquals(StoredWorkflowStatus.FAILED_TERMINAL, workflow.status()))
        .verifyComplete();
    StepVerifier.create(store.findToolStepsAfter("workspace-default", workflowId.get(), 0))
        .verifyComplete();
  }

  @Test
  void reusesCompletedWorkflowWithPersistedMultiToolStepsWithoutRerunningRuntime() {
    Clock clock = fixedClock();
    var store = new InMemoryAgentWorkflowStore();
    var runtimeCalls = new AtomicInteger();
    var workflowId = new AtomicReference<String>();
    var service = new AgentDiagnosticWorkflowService(
        runtimeRequest -> {
          runtimeCalls.incrementAndGet();
          workflowId.set(runtimeRequest.workflowId());
          OffsetDateTime now = OffsetDateTime.now(clock);
          return store.appendToolStep(toolStep(runtimeRequest, 1, "tool-call-1", "node-health", now))
              .then(store.markToolStepCompleted(
                  runtimeRequest.workspaceId(),
                  runtimeRequest.workflowId(),
                  1,
                  StoredWorkflowStatus.SUCCEEDED,
                  null,
                  null,
                  now.plusSeconds(1)))
              .then(store.appendToolStep(toolStep(runtimeRequest, 2, "tool-call-2", "application-log-summary", now.plusSeconds(2))))
              .then(store.markToolStepCompleted(
                  runtimeRequest.workspaceId(),
                  runtimeRequest.workflowId(),
                  2,
                  StoredWorkflowStatus.SUCCEEDED,
                  null,
                  null,
                  now.plusSeconds(3)))
              .thenReturn(new AgentRuntimeResult("SUCCEEDED", "node and log checks are healthy", 2));
        },
        store,
        clock);

    StepVerifier.create(service.execute(request("task-3", "idempotency-3")))
        .assertNext(result -> {
          assertEquals("SUCCEEDED", result.status());
          assertEquals("node and log checks are healthy", result.summary());
          assertEquals(2, result.toolCallCount());
        })
        .verifyComplete();

    StepVerifier.create(service.execute(request("task-3", "idempotency-3")))
        .assertNext(result -> {
          assertEquals(workflowId.get(), result.workflowId());
          assertEquals("SUCCEEDED", result.status());
          assertEquals(2, result.toolCallCount());
          assertEquals("node and log checks are healthy", result.summary());
        })
        .verifyComplete();
    assertEquals(1, runtimeCalls.get());
  }

  @Test
  void reusesTerminalWorkflowWithOriginalRuntimeFailureStatusAndSummary() {
    Clock clock = fixedClock();
    var store = new InMemoryAgentWorkflowStore();
    var runtimeCalls = new AtomicInteger();
    var service = new AgentDiagnosticWorkflowService(
        runtimeRequest -> {
          runtimeCalls.incrementAndGet();
          return Mono.just(new AgentRuntimeResult(
              "AGENT_RUNTIME_FAILED",
              "AgentScope runtime failed before producing a valid result.",
              0));
        },
        store,
        clock);

    StepVerifier.create(service.execute(request("task-4", "idempotency-4")))
        .assertNext(result -> {
          assertEquals("AGENT_RUNTIME_FAILED", result.status());
          assertEquals("AgentScope runtime failed before producing a valid result.", result.summary());
          assertEquals(0, result.toolCallCount());
        })
        .verifyComplete();

    StepVerifier.create(service.execute(request("task-4", "idempotency-4")))
        .assertNext(result -> {
          assertEquals("AGENT_RUNTIME_FAILED", result.status());
          assertEquals("AgentScope runtime failed before producing a valid result.", result.summary());
          assertEquals(0, result.toolCallCount());
        })
        .verifyComplete();
    assertEquals(1, runtimeCalls.get());
  }

  private AgentTaskRequest request(String taskId, String idempotencyKey) {
    return new AgentTaskRequest(
        "1.0",
        taskId,
        idempotencyKey,
        new WorkspaceContext("workspace-default", "default", "Default Workspace"),
        new OperatorContext("operator-1", List.of("ROLE_ops-reader")),
        "development",
        "check node-1 health",
        Map.of("nodeId", "node-1"),
        new PolicyDecisionReference("decision-1", "policy-v1", "ALLOW"),
        new TraceContext("trace-1", "request-1"),
        OffsetDateTime.now(fixedClock()));
  }

  private StoredAgentToolStep toolStep(
      AgentRuntimeRequest runtimeRequest,
      long stepSequence,
      String toolCallId,
      String skillId,
      OffsetDateTime requestedAt) {
    return new StoredAgentToolStep(
        runtimeRequest.workflowId(),
        runtimeRequest.workspaceId(),
        stepSequence,
        toolCallId,
        skillId,
        "1.0.0",
        "sha256:" + stepSequence,
        "decision-" + stepSequence,
        StoredWorkflowStatus.RUNNING,
        requestedAt,
        null,
        null,
        null);
  }

  private Clock fixedClock() {
    return Clock.fixed(Instant.parse("2026-06-13T12:00:00Z"), ZoneOffset.UTC);
  }
}
