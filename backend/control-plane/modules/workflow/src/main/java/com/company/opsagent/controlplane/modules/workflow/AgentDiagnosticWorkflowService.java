package com.company.opsagent.controlplane.modules.workflow;

import com.company.opsagent.contracts.agent.AgentTaskRequest;
import com.company.opsagent.contracts.agent.AgentTaskResult;
import com.company.opsagent.controlplane.modules.agentruntime.AgentRuntimeRequest;
import com.company.opsagent.controlplane.modules.agentruntime.AgentRuntimeResult;
import com.company.opsagent.controlplane.modules.agentruntime.AgentRuntimeService;
import java.time.Clock;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;
import reactor.core.publisher.Mono;

/**
 * 在持久化工作流边界内运行主 Agent 诊断链路。
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
        .flatMap(workflow -> isTerminal(workflow.status())
            ? reuseTerminalWorkflow(request, workflow)
            : executeRuntime(request, workflow));
  }

  private Mono<AgentTaskResult> executeRuntime(
      AgentTaskRequest request,
      StoredAgentWorkflow workflow) {
    AgentRuntimeRequest runtimeRequest = new AgentRuntimeRequest(
        request.taskId(),
        workflow.workflowId(),
        request.workspace().workspaceId(),
        request.operator().operatorId(),
        request.operator().roles(),
        request.targetEnvironment(),
        request.userIntent(),
        request.inputParameters(),
        request.trace().traceId(),
        request.trace().requestId());
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
            runtimeResult.status(),
            runtimeResult.summary(),
            runtimeResult.toolCallCount(),
            completedAt)
        .thenReturn(new AgentTaskResult(
            "1.0",
            request.taskId(),
            workflow.workflowId(),
            runtimeResult.status(),
            runtimeResult.summary(),
            runtimeResult.toolCallCount(),
            completedAt,
            runtimeResult.toolResults()));
  }

  private Mono<AgentTaskResult> completeWithRuntimeFailure(
      AgentTaskRequest request,
      StoredAgentWorkflow workflow) {
    OffsetDateTime completedAt = OffsetDateTime.now(clock);
    return workflowStore.markWorkflowCompleted(
            workflow.workspaceId(),
            workflow.workflowId(),
            StoredWorkflowStatus.FAILED_TERMINAL,
            FAILED_TERMINAL,
            RUNTIME_FAILURE_SUMMARY,
            0,
            completedAt)
        .thenReturn(new AgentTaskResult(
            "1.0",
            request.taskId(),
            workflow.workflowId(),
            FAILED_TERMINAL,
            RUNTIME_FAILURE_SUMMARY,
            0,
            completedAt,
            List.of()));
  }

  /**
   * 复用已完成的 Agent workflow。
   *
   * <p>Agent 主链路可能包含多个 Tool Step。幂等重试命中终态 workflow 时，不能再次驱动
   * 模型或重复提交 Worker；新写入的 workflow 会直接复用持久化的终态 AgentTaskResult。
   * 旧数据若还没有结果快照，则退回到 Tool Step 事实源恢复最小兼容结果。
   */
  private Mono<AgentTaskResult> reuseTerminalWorkflow(
      AgentTaskRequest request,
      StoredAgentWorkflow workflow) {
    if (workflow.resultStatus() != null
        && workflow.resultSummary() != null
        && workflow.resultToolCallCount() != null) {
      return Mono.just(new AgentTaskResult(
          "1.0",
          request.taskId(),
          workflow.workflowId(),
          workflow.resultStatus(),
          workflow.resultSummary(),
          workflow.resultToolCallCount(),
          workflow.completedAt() == null ? workflow.updatedAt() : workflow.completedAt(),
          List.of()));
    }
    return workflowStore.findToolStepsAfter(workflow.workspaceId(), workflow.workflowId(), 0)
        .count()
        .map(toolStepCount -> new AgentTaskResult(
            "1.0",
            request.taskId(),
            workflow.workflowId(),
            workflow.status().name(),
            reusedSummary(workflow.status()),
            Math.toIntExact(toolStepCount),
            workflow.completedAt() == null ? workflow.updatedAt() : workflow.completedAt(),
            List.of()));
  }

  private boolean isTerminal(StoredWorkflowStatus status) {
    return status == StoredWorkflowStatus.SUCCEEDED
        || status == StoredWorkflowStatus.FAILED_TERMINAL;
  }

  private String reusedSummary(StoredWorkflowStatus status) {
    if (status == StoredWorkflowStatus.SUCCEEDED) {
      return "Agent workflow result was reused from persisted workflow state.";
    }
    return "Agent workflow failure was reused from persisted workflow state.";
  }
}
