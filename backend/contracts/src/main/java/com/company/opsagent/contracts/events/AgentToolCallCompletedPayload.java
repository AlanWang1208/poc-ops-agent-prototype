package com.company.opsagent.contracts.events;

import static com.company.opsagent.contracts.ContractValues.requiredText;

import java.util.Set;

/**
 * Agent Tool 调用完成事件载荷。
 *
 * <p>该事件描述 Tool 执行已经结束，并只暴露状态和输出契约标识。真实输出仍通过
 * 受控结果契约传递，避免操作台从展示文本中反推安全状态。
 */
public record AgentToolCallCompletedPayload(
    SemanticEventType payloadType,
    String toolCallId,
    long stepSequence,
    String skillId,
    String skillVersion,
    String status,
    String outputSchemaId) implements SemanticEventPayload {

  private static final Set<String> ALLOWED_STATUSES = Set.of("SUCCEEDED", "FAILED");

  public AgentToolCallCompletedPayload {
    if (payloadType != SemanticEventType.AGENT_TOOL_CALL_COMPLETED) {
      throw new IllegalArgumentException("payloadType must be AGENT_TOOL_CALL_COMPLETED");
    }
    toolCallId = requiredText(toolCallId, "toolCallId");
    if (stepSequence < 1) {
      throw new IllegalArgumentException("stepSequence must be positive");
    }
    skillId = requiredText(skillId, "skillId");
    skillVersion = requiredText(skillVersion, "skillVersion");
    status = requiredText(status, "status");
    if (!ALLOWED_STATUSES.contains(status)) {
      throw new IllegalArgumentException("unsupported agent tool completion status");
    }
    outputSchemaId = requiredText(outputSchemaId, "outputSchemaId");
  }
}
