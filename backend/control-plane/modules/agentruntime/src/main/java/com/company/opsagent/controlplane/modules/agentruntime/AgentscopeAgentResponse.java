package com.company.opsagent.controlplane.modules.agentruntime;

public record AgentscopeAgentResponse(
    String status,
    String summary,
    int toolCallCount) {

  public AgentscopeAgentResponse {
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
