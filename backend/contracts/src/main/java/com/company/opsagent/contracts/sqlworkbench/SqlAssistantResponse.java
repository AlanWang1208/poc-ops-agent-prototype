package com.company.opsagent.contracts.sqlworkbench;

import static com.company.opsagent.contracts.ContractValues.required;
import static com.company.opsagent.contracts.ContractValues.requiredText;

import java.util.List;

public record SqlAssistantResponse(
    String contractVersion,
    SqlAssistantStatus status,
    SqlAssistantAction assistantAction,
    String summary,
    List<SqlAssistantSuggestion> suggestions,
    List<String> safetyNotes,
    boolean validationRequired,
    String modelProviderFingerprint) {

  public SqlAssistantResponse {
    if (!"1.0".equals(contractVersion)) {
      throw new IllegalArgumentException("contractVersion must be 1.0");
    }
    status = required(status, "status");
    assistantAction = required(assistantAction, "assistantAction");
    summary = requiredText(summary, "summary");
    suggestions = suggestions == null ? List.of() : List.copyOf(suggestions);
    safetyNotes = safetyNotes == null ? List.of() : List.copyOf(safetyNotes);
    if (status == SqlAssistantStatus.SUCCEEDED && !validationRequired) {
      throw new IllegalArgumentException("successful SQL assistant responses require validation");
    }
    modelProviderFingerprint = optionalText(modelProviderFingerprint);
  }

  private static String optionalText(String value) {
    if (value == null || value.isBlank()) {
      return null;
    }
    return value.trim();
  }
}
