package com.company.opsagent.contracts.agent;

import static com.company.opsagent.contracts.ContractValues.required;
import static com.company.opsagent.contracts.ContractValues.requiredText;
import static com.company.opsagent.contracts.ContractValues.requiredTime;

import com.company.opsagent.contracts.workflow.OperatorContext;
import com.company.opsagent.contracts.workflow.PolicyDecisionReference;
import com.company.opsagent.contracts.workflow.TraceContext;
import com.company.opsagent.contracts.workflow.WorkspaceContext;
import java.time.OffsetDateTime;
import java.util.Map;

/**
 * 控制面提交给主 Agent Runtime 的只读诊断任务请求。
 */
public record AgentTaskRequest(
    String schemaVersion,
    String taskId,
    String idempotencyKey,
    WorkspaceContext workspace,
    OperatorContext operator,
    String targetEnvironment,
    String userIntent,
    Map<String, String> inputParameters,
    PolicyDecisionReference policyDecision,
    TraceContext trace,
    OffsetDateTime requestedAt) {

  public AgentTaskRequest {
    if (!"1.0".equals(schemaVersion)) {
      throw new IllegalArgumentException("unsupported agent task request schema version");
    }
    taskId = requiredText(taskId, "taskId");
    idempotencyKey = requiredText(idempotencyKey, "idempotencyKey");
    workspace = required(workspace, "workspace");
    operator = required(operator, "operator");
    targetEnvironment = requiredText(targetEnvironment, "targetEnvironment");
    userIntent = requiredText(userIntent, "userIntent");
    inputParameters = Map.copyOf(required(inputParameters, "inputParameters"));
    policyDecision = required(policyDecision, "policyDecision");
    trace = required(trace, "trace");
    requestedAt = requiredTime(requestedAt, "requestedAt");
  }
}
