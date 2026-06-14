package com.company.opsagent.contracts.agent;

import static com.company.opsagent.contracts.ContractValues.required;
import static com.company.opsagent.contracts.ContractValues.requiredText;
import static com.company.opsagent.contracts.ContractValues.requiredTime;

import com.company.opsagent.contracts.workflow.PolicyDecisionReference;
import com.company.opsagent.contracts.workflow.SkillReference;
import com.company.opsagent.contracts.workflow.TraceContext;
import java.time.OffsetDateTime;
import java.util.Map;

/**
 * 主 Agent Runtime 请求调用只读 Skill Tool 的强类型信封。
 */
public record AgentToolCall(
    String schemaVersion,
    String toolCallId,
    String taskId,
    String workflowId,
    long stepSequence,
    SkillReference skill,
    String targetEnvironment,
    Map<String, String> parameters,
    String parametersHash,
    PolicyDecisionReference policyDecision,
    TraceContext trace,
    OffsetDateTime requestedAt) {

  public AgentToolCall {
    if (!"1.0".equals(schemaVersion)) {
      throw new IllegalArgumentException("unsupported agent tool call schema version");
    }
    toolCallId = requiredText(toolCallId, "toolCallId");
    taskId = requiredText(taskId, "taskId");
    workflowId = requiredText(workflowId, "workflowId");
    if (stepSequence < 1) {
      throw new IllegalArgumentException("stepSequence must be positive");
    }
    skill = required(skill, "skill");
    targetEnvironment = requiredText(targetEnvironment, "targetEnvironment");
    parameters = Map.copyOf(required(parameters, "parameters"));
    parametersHash = requiredText(parametersHash, "parametersHash");
    policyDecision = required(policyDecision, "policyDecision");
    trace = required(trace, "trace");
    requestedAt = requiredTime(requestedAt, "requestedAt");
  }
}
