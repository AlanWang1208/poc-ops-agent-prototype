package com.company.opsagent.executionworker;

import com.company.opsagent.contracts.workflow.WorkerExecutionRequest;
import com.company.opsagent.contracts.workflow.WorkerExecutionResult;
import com.company.opsagent.contracts.workflow.WorkerExecutionStatus;
import com.fasterxml.jackson.databind.JsonNode;
import java.time.Clock;
import java.time.OffsetDateTime;
import java.util.List;

/**
 * 受限只读执行 Worker。
 *
 * <p>Worker 不做授权决策，只校验请求仍有效并执行显式注册的只读适配器。
 */
public class RestrictedReadOnlyExecutionWorker {

  private final List<ReadOnlySkillAdapter> adapters;
  private final Clock clock;

  public RestrictedReadOnlyExecutionWorker(List<ReadOnlySkillAdapter> adapters, Clock clock) {
    this.adapters = List.copyOf(adapters);
    this.clock = clock;
  }

  /**
   * 执行有效请求；过期、未知 Skill 或非法参数均返回结构化拒绝。
   */
  public WorkerExecutionResult execute(WorkerExecutionRequest request) {
    OffsetDateTime completedAt = OffsetDateTime.now(clock);
    if (!request.expiresAt().isAfter(completedAt)) {
      return rejected(request, "REQUEST_EXPIRED", "execution request has expired", completedAt);
    }

    ReadOnlySkillAdapter adapter = adapters.stream()
        .filter(candidate -> candidate.supports(
            request.command().skill().skillId(),
            request.command().skill().version()))
        .findFirst()
        .orElse(null);
    if (adapter == null) {
      return rejected(request, "SKILL_NOT_ALLOWED", "skill version is not registered in worker", completedAt);
    }

    try {
      JsonNode output = adapter.execute(request.command());
      return result(request, WorkerExecutionStatus.SUCCEEDED, output, null, null, completedAt);
    } catch (IllegalArgumentException exception) {
      return rejected(request, "INVALID_PARAMETERS", exception.getMessage(), completedAt);
    } catch (WorkerHttpEgressException exception) {
      return rejected(request, exception.errorCode(), exception.safeMessage(), completedAt);
    } catch (RuntimeException exception) {
      return result(request, WorkerExecutionStatus.FAILED, null, "WORKER_EXECUTION_FAILED",
          "read-only adapter failed", completedAt);
    }
  }

  private WorkerExecutionResult rejected(
      WorkerExecutionRequest request,
      String errorCode,
      String errorMessage,
      OffsetDateTime completedAt) {
    return result(request, WorkerExecutionStatus.REJECTED, null, errorCode, errorMessage, completedAt);
  }

  private WorkerExecutionResult result(
      WorkerExecutionRequest request,
      WorkerExecutionStatus status,
      JsonNode output,
      String errorCode,
      String errorMessage,
      OffsetDateTime completedAt) {
    return new WorkerExecutionResult(
        "1.0",
        request.executionRequestId(),
        request.command().commandId(),
        request.command().workflowId(),
        status,
        request.command().skill().outputSchemaId(),
        output,
        errorCode,
        errorMessage,
        completedAt);
  }
}
