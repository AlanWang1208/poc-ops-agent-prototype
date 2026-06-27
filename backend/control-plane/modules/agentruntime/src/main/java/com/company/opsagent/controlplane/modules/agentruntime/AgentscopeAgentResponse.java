package com.company.opsagent.controlplane.modules.agentruntime;

import com.company.opsagent.contracts.agent.AgentToolResult;
import java.util.List;

public record AgentscopeAgentResponse(
    String status,
    String summary,
    int toolCallCount,
    List<AgentToolResult> toolResults) {

  public AgentscopeAgentResponse {
    status = requiredText(status, "status");
    summary = requiredText(summary, "summary");
    if (toolCallCount < 0) {
      throw new IllegalArgumentException("toolCallCount must not be negative");
    }
    toolResults = List.copyOf(toolResults == null ? List.of() : toolResults);
  }

  public AgentscopeAgentResponse(
      String status,
      String summary,
      int toolCallCount) {
    this(status, summary, toolCallCount, List.of());
  }

  private static String requiredText(String value, String fieldName) {
    if (value == null || value.isBlank()) {
      throw new IllegalArgumentException(fieldName + " must not be blank");
    }
    return value;
  }
}
