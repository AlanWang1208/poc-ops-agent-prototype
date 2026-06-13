package com.company.opsagent.controlplane.modules.workflow;

import static com.company.opsagent.contracts.ContractValues.required;
import static com.company.opsagent.contracts.ContractValues.requiredText;

import com.company.opsagent.contracts.workflow.OperatorContext;
import com.company.opsagent.contracts.workflow.PolicyDecisionReference;
import com.company.opsagent.contracts.workflow.TraceContext;
import com.fasterxml.jackson.databind.JsonNode;

/**
 * 启动只读诊断工作流所需的可信输入。
 */
public record ReadOnlyWorkflowRequest(
    String skillId,
    String targetEnvironment,
    String idempotencyKey,
    JsonNode parameters,
    OperatorContext operator,
    PolicyDecisionReference policyDecision,
    TraceContext trace) {

  public ReadOnlyWorkflowRequest {
    skillId = requiredText(skillId, "skillId");
    targetEnvironment = requiredText(targetEnvironment, "targetEnvironment");
    idempotencyKey = requiredText(idempotencyKey, "idempotencyKey");
    parameters = required(parameters, "parameters");
    operator = required(operator, "operator");
    policyDecision = required(policyDecision, "policyDecision");
    trace = required(trace, "trace");
  }
}
