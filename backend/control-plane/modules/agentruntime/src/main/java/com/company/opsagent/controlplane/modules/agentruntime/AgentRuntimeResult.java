package com.company.opsagent.controlplane.modules.agentruntime;

/**
 * 主 Agent Runtime 返回给工作流的运行结果摘要。
 */
public record AgentRuntimeResult(
    String status,
    String summary,
    int toolCallCount) {

  public AgentRuntimeResult {
    status = requiredText(status, "status");
    summary = requiredText(summary, "summary");
    if (toolCallCount < 0) {
      throw new IllegalArgumentException("toolCallCount must not be negative");
    }
  }

  private static String requiredText(String value, String fieldName) {
    if (value == null || value.isBlank()) {
      throw new IllegalArgumentException(fieldName + " must not be blank");
    }
    return value;
  }
}
