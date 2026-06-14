package com.company.opsagent.controlplane.modules.agentruntime;

import java.util.Map;

/**
 * 控制面传递给主 Agent Runtime 的脱敏运行请求。
 */
public record AgentRuntimeRequest(
    String taskId,
    String workflowId,
    String workspaceId,
    String operatorId,
    String targetEnvironment,
    String userIntent,
    Map<String, String> inputParameters) {

  public AgentRuntimeRequest {
    taskId = requiredText(taskId, "taskId");
    workflowId = requiredText(workflowId, "workflowId");
    workspaceId = requiredText(workspaceId, "workspaceId");
    operatorId = requiredText(operatorId, "operatorId");
    targetEnvironment = requiredText(targetEnvironment, "targetEnvironment");
    userIntent = requiredText(userIntent, "userIntent");
    inputParameters = Map.copyOf(inputParameters == null ? Map.of() : inputParameters);
  }

  private static String requiredText(String value, String fieldName) {
    if (value == null || value.isBlank()) {
      throw new IllegalArgumentException(fieldName + " must not be blank");
    }
    return value;
  }
}
