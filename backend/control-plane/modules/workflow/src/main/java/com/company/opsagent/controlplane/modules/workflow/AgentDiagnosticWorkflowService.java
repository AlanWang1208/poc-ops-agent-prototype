package com.company.opsagent.controlplane.modules.workflow;

import com.company.opsagent.contracts.agent.AgentTaskRequest;
import com.company.opsagent.contracts.agent.AgentTaskResult;
import com.company.opsagent.controlplane.modules.agentruntime.AgentRuntimeRequest;
import com.company.opsagent.controlplane.modules.agentruntime.AgentRuntimeResult;
import com.company.opsagent.controlplane.modules.agentruntime.AgentRuntimeService;
import java.time.Clock;
import java.time.OffsetDateTime;
import java.util.UUID;
import reactor.core.publisher.Mono;

/**
 * Runs the primary Agent runtime inside a persisted workflow boundary.
 */
public class AgentDiagnosticWorkflowService {

  private static final String FAILED_TERMINAL = "FAILED_TERMINAL";
  private static final String RUNTIME_FAILURE_SUMMARY =
      "Agent runtime failed before a tool call could be completed.";

  private final AgentRuntimeService agentRuntimeService;
  private final AgentWorkflowStore workflowStore;
  private final Clock clock;

  public AgentDiagnosticWorkflowService(
      AgentRuntimeService agentRuntimeService,
      AgentWorkflowStore workflowStore,
      Clock clock) {
    this.agentRuntimeService = agentRuntimeService;
    this.workflowStore = workflowStore;
    this.clock = clock;
  }

  public Mono<AgentTaskResult> execute(AgentTaskRequest request) {
    OffsetDateTime now = OffsetDateTime.now(clock);
    String proposedWorkflowId = UUID.randomUUID().toString();
    return workflowStore.createOrReuse(
            proposedWorkflowId,
            request.workspace().workspaceId(),
            request.operator().operatorId(),
            request.targetEnvironment(),
            request.idempotencyKey(),
            now)
        .flatMap(workflow -> executeRuntime(request, workflow));
  }

  private Mono<AgentTaskResult> executeRuntime(
      AgentTaskRequest request,
      StoredAgentWorkflow workflow) {
    AgentRuntimeRequest runtimeRequest = new AgentRuntimeRequest(
        request.taskId(),
        workflow.workflowId(),
        request.workspace().workspaceId(),
        request.operator().operatorId(),
        request.targetEnvironment(),
        request.userIntent(),
        request.inputParameters());
    return agentRuntimeService.run(runtimeRequest)
        .flatMap(runtimeResult -> completeWithRuntimeResult(request, workflow, runtimeResult))
        .onErrorResume(error -> completeWithRuntimeFailure(request, workflow));
  }

  private Mono<AgentTaskResult> completeWithRuntimeResult(
      AgentTaskRequest request,
      StoredAgentWorkflow workflow,
      AgentRuntimeResult runtimeResult) {
    OffsetDateTime completedAt = OffsetDateTime.now(clock);
    StoredWorkflowStatus storedStatus = "SUCCEEDED".equals(runtimeResult.status())
        ? StoredWorkflowStatus.SUCCEEDED
        : StoredWorkflowStatus.FAILED_TERMINAL;
    return workflowStore.markWorkflowCompleted(
            workflow.workspaceId(),
            workflow.workflowId(),
            storedStatus,
            completedAt)
        .thenReturn(new AgentTaskResult(
            "1.0",
            request.taskId(),
            workflow.workflowId(),
            runtimeResult.status(),
            runtimeResult.summary(),
            runtimeResult.toolCallCount(),
            completedAt));
  }

  private Mono<AgentTaskResult> completeWithRuntimeFailure(
      AgentTaskRequest request,
      StoredAgentWorkflow workflow) {
    OffsetDateTime completedAt = OffsetDateTime.now(clock);
    return workflowStore.markWorkflowCompleted(
            workflow.workspaceId(),
            workflow.workflowId(),
            StoredWorkflowStatus.FAILED_TERMINAL,
            completedAt)
        .thenReturn(new AgentTaskResult(
            "1.0",
            request.taskId(),
            workflow.workflowId(),
            FAILED_TERMINAL,
            RUNTIME_FAILURE_SUMMARY,
            0,
            completedAt));
  }
}
