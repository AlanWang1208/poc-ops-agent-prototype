package com.company.opsagent.contracts.events;

import static com.company.opsagent.contracts.ContractValues.required;
import static com.company.opsagent.contracts.ContractValues.requiredText;
import static com.company.opsagent.contracts.ContractValues.requiredTime;

import java.time.OffsetDateTime;

/**
 * 操作台消费的版本化强类型语义事件。
 */
public record SemanticEvent(
    String contractVersion,
    String eventId,
    String workflowId,
    long sequence,
    OffsetDateTime timestamp,
    SemanticEventType type,
    SemanticEventPayload payload) {

  public SemanticEvent {
    if (!"1.0".equals(contractVersion)) {
      throw new IllegalArgumentException("unsupported semantic event contract version");
    }
    eventId = requiredText(eventId, "eventId");
    workflowId = requiredText(workflowId, "workflowId");
    if (sequence < 1) {
      throw new IllegalArgumentException("sequence must be positive");
    }
    timestamp = requiredTime(timestamp, "timestamp");
    type = required(type, "type");
    payload = required(payload, "payload");
    if (payload.payloadType() != type) {
      throw new IllegalArgumentException("event type and payload type must match");
    }
  }
}
