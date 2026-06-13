package com.company.opsagent.contracts.workflow;

import static com.company.opsagent.contracts.ContractValues.required;
import static com.company.opsagent.contracts.ContractValues.requiredText;
import static com.company.opsagent.contracts.ContractValues.requiredTime;

import com.fasterxml.jackson.databind.JsonNode;
import java.time.OffsetDateTime;

/**
 * 携带 Team Workspace 上下文的已授权只读命令信封。
 *
 * <p>该 v2 契约用于 POC 阶段的团队级隔离和定制闭环，v1 历史契约保留不变。
 */
public record ReadOnlyCommandEnvelopeV2(
    String contractVersion,
    WorkspaceContext workspace,
    String commandId,
    String workflowId,
    String idempotencyKey,
    String operationClass,
    String targetEnvironment,
    SkillReference skill,
    JsonNode parameters,
    OperatorContext operator,
    PolicyDecisionReference policyDecision,
    TraceContext trace,
    OffsetDateTime requestedAt) {

  public ReadOnlyCommandEnvelopeV2 {
    if (!"2.0".equals(contractVersion)) {
      throw new IllegalArgumentException("unsupported command contract version");
    }
    workspace = required(workspace, "workspace");
    commandId = requiredText(commandId, "commandId");
    workflowId = requiredText(workflowId, "workflowId");
    idempotencyKey = requiredText(idempotencyKey, "idempotencyKey");
    if (!"READ_ONLY".equals(operationClass)) {
      throw new IllegalArgumentException("P1 only accepts READ_ONLY commands");
    }
    targetEnvironment = requiredText(targetEnvironment, "targetEnvironment");
    skill = required(skill, "skill");
    parameters = required(parameters, "parameters");
    if (!parameters.isObject()) {
      throw new IllegalArgumentException("parameters must be a schema-constrained object");
    }
    operator = required(operator, "operator");
    policyDecision = required(policyDecision, "policyDecision");
    trace = required(trace, "trace");
    requestedAt = requiredTime(requestedAt, "requestedAt");
  }
}
