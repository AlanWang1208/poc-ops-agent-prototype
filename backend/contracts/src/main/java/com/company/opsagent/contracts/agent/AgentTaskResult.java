package com.company.opsagent.contracts.agent;

import static com.company.opsagent.contracts.ContractValues.requiredText;
import static com.company.opsagent.contracts.ContractValues.requiredTime;

import java.time.OffsetDateTime;
import java.util.Set;

/**
 * 主 Agent Runtime 返回给工作流的最终任务结果。
 *
 * <p>该契约位于控制面、工作流和前端操作台之间，状态值必须保持版本化和显式枚举。模型运行失败、运行时未启用、
 * 运行时未配置和策略拒绝都需要稳定状态，前端不得从摘要文本里推断安全或执行结果。
 */
public record AgentTaskResult(
    String schemaVersion,
    String taskId,
    String workflowId,
    String status,
    String summary,
    int toolCallCount,
    OffsetDateTime completedAt) {

  /**
   * P1 Agent 诊断结果允许的状态集合。
   *
   * <p>这里故意不保留旧的 `FAILED` 泛化状态，避免调用方无法区分终态失败、策略拒绝和运行时基础设施不可用。
   */
  private static final Set<String> ALLOWED_STATUSES = Set.of(
      "SUCCEEDED",
      "FAILED_TERMINAL",
      "REJECTED",
      "AGENT_RUNTIME_DISABLED",
      "AGENT_RUNTIME_NOT_CONFIGURED",
      "AGENT_RUNTIME_FAILED");

  public AgentTaskResult {
    if (!"1.0".equals(schemaVersion)) {
      throw new IllegalArgumentException("unsupported agent task result schema version");
    }
    taskId = requiredText(taskId, "taskId");
    workflowId = requiredText(workflowId, "workflowId");
    status = requiredText(status, "status");
    if (!ALLOWED_STATUSES.contains(status)) {
      throw new IllegalArgumentException("unsupported agent task result status");
    }
    summary = requiredText(summary, "summary");
    if (toolCallCount < 0) {
      throw new IllegalArgumentException("toolCallCount must not be negative");
    }
    completedAt = requiredTime(completedAt, "completedAt");
  }
}
