package com.company.opsagent.contracts.sqlworkbench;

import static com.company.opsagent.contracts.ContractValues.required;
import static com.company.opsagent.contracts.ContractValues.requiredText;

public record SqlAssistantRequest(
    String contractVersion,
    String connectionId,
    String targetEnvironment,
    String schema,
    SqlAssistantAction assistantAction,
    String sql,
    SqlQueryLimits limits,
    String diagnosticContext,
    String idempotencyKey) {

  private static final int MAX_SQL_LENGTH = 20_000;
  private static final int MAX_DIAGNOSTIC_CONTEXT_LENGTH = 4_000;

  public SqlAssistantRequest {
    if (!"1.0".equals(contractVersion)) {
      throw new IllegalArgumentException("contractVersion must be 1.0");
    }
    connectionId = requiredText(connectionId, "connectionId");
    targetEnvironment = requiredText(targetEnvironment, "targetEnvironment");
    if ("production".equalsIgnoreCase(targetEnvironment)) {
      throw new IllegalArgumentException("production SQL assistant requests are not allowed");
    }
    schema = requiredText(schema, "schema");
    assistantAction = required(assistantAction, "assistantAction");
    sql = boundedRequiredText(sql, "sql", MAX_SQL_LENGTH);
    limits = required(limits, "limits");
    diagnosticContext = optionalText(diagnosticContext, "diagnosticContext", MAX_DIAGNOSTIC_CONTEXT_LENGTH);
    idempotencyKey = requiredText(idempotencyKey, "idempotencyKey");
  }

  private static String boundedRequiredText(String value, String fieldName, int maxLength) {
    String normalized = requiredText(value, fieldName);
    if (normalized.length() > maxLength) {
      throw new IllegalArgumentException(fieldName + " is too long");
    }
    return normalized;
  }

  private static String optionalText(String value, String fieldName, int maxLength) {
    if (value == null) {
      return null;
    }
    String normalized = value.trim();
    if (normalized.isBlank()) {
      return null;
    }
    if (normalized.length() > maxLength) {
      throw new IllegalArgumentException(fieldName + " is too long");
    }
    return normalized;
  }
}
