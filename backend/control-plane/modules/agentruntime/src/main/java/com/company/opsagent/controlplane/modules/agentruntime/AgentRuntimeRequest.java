package com.company.opsagent.controlplane.modules.agentruntime;

import java.util.List;
import java.util.Map;

/**
 * 控制面传递给主 Agent Runtime 的脱敏运行请求。
 */
public record AgentRuntimeRequest(
    String taskId,
    String workflowId,
    String workspaceId,
    String operatorId,
    List<String> operatorRoles,
    String targetEnvironment,
    String userIntent,
    Map<String, String> inputParameters,
    String traceId,
    String requestId) {

  public AgentRuntimeRequest {
    taskId = requiredText(taskId, "taskId");
    workflowId = requiredText(workflowId, "workflowId");
    workspaceId = requiredText(workspaceId, "workspaceId");
    operatorId = requiredText(operatorId, "operatorId");
    operatorRoles = List.copyOf(operatorRoles == null ? List.of() : operatorRoles);
    targetEnvironment = requiredText(targetEnvironment, "targetEnvironment");
    userIntent = requiredText(userIntent, "userIntent");
    inputParameters = Map.copyOf(inputParameters == null ? Map.of() : inputParameters);
    traceId = requiredText(traceId, "traceId");
    requestId = requiredText(requestId, "requestId");
  }

  private static String requiredText(String value, String fieldName) {
    if (value == null || value.isBlank()) {
      throw new IllegalArgumentException(fieldName + " must not be blank");
    }
    return value;
  }
}
