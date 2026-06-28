package com.company.opsagent.contracts.sqlworkbench;

import static com.company.opsagent.contracts.ContractValues.requiredText;

public record SqlAssistantSuggestion(
    String title,
    String rationale,
    String suggestedSql) {

  private static final int MAX_SUGGESTED_SQL_LENGTH = 20_000;

  public SqlAssistantSuggestion {
    title = requiredText(title, "title");
    rationale = requiredText(rationale, "rationale");
    suggestedSql = optionalText(suggestedSql, "suggestedSql", MAX_SUGGESTED_SQL_LENGTH);
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
