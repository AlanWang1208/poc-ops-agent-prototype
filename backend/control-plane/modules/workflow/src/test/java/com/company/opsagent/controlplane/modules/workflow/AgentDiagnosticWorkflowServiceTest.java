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

  private Clock fixedClock() {
    return Clock.fixed(Instant.parse("2026-06-13T12:00:00Z"), ZoneOffset.UTC);
  }
}
