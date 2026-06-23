package com.company.opsagent.contracts.events;

import static com.company.opsagent.contracts.ContractValues.requiredText;

/**
 * Agent Tool 调用拒绝事件载荷。
 *
 * <p>该载荷用于展示平台拒绝了某次模型 Tool 意图。拒绝可能来自目录、策略、
 * 上下文或 Worker 二次边界；事件必须保留策略决策引用，方便审计追溯。
 */
public record AgentToolCallRejectedPayload(
    SemanticEventType payloadType,
    String toolCallId,
    long stepSequence,
    String skillId,
    String skillVersion,
    String errorCode,
    String message,
    String policyDecisionId) implements SemanticEventPayload {

  public AgentToolCallRejectedPayload {
    if (payloadType != SemanticEventType.AGENT_TOOL_CALL_REJECTED) {
      throw new IllegalArgumentException("payloadType must be AGENT_TOOL_CALL_REJECTED");
    }
    toolCallId = requiredText(toolCallId, "toolCallId");
    if (stepSequence < 1) {
      throw new IllegalArgumentException("stepSequence must be positive");
    }
    skillId = requiredText(skillId, "skillId");
    skillVersion = requiredText(skillVersion, "skillVersion");
    errorCode = requiredText(errorCode, "errorCode");
    message = requiredText(message, "message");
    policyDecisionId = requiredText(policyDecisionId, "policyDecisionId");
  }
}
