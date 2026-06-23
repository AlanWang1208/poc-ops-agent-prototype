package com.company.opsagent.contracts.events;

import static com.company.opsagent.contracts.ContractValues.requiredText;

/**
 * Agent Tool 调用请求事件载荷。
 *
 * <p>该载荷用于让操作台展示模型提出了哪个只读 Tool 意图。它只携带参数哈希，
 * 不携带原始参数，避免把可能敏感或未脱敏的模型输入直接写入语义事件。
 */
public record AgentToolCallRequestedPayload(
    SemanticEventType payloadType,
    String toolCallId,
    long stepSequence,
    String skillId,
    String skillVersion,
    String parameterSchemaId,
    String targetEnvironment,
    String parametersHash) implements SemanticEventPayload {

  public AgentToolCallRequestedPayload {
    if (payloadType != SemanticEventType.AGENT_TOOL_CALL_REQUESTED) {
      throw new IllegalArgumentException("payloadType must be AGENT_TOOL_CALL_REQUESTED");
    }
    toolCallId = requiredText(toolCallId, "toolCallId");
    if (stepSequence < 1) {
      throw new IllegalArgumentException("stepSequence must be positive");
    }
    skillId = requiredText(skillId, "skillId");
    skillVersion = requiredText(skillVersion, "skillVersion");
    parameterSchemaId = requiredText(parameterSchemaId, "parameterSchemaId");
    targetEnvironment = requiredText(targetEnvironment, "targetEnvironment");
    parametersHash = requiredText(parametersHash, "parametersHash");
  }
}
