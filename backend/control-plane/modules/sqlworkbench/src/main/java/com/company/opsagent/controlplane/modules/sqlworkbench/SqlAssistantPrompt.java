package com.company.opsagent.controlplane.modules.sqlworkbench;

import com.company.opsagent.contracts.sqlworkbench.SqlAssistantAction;
import com.company.opsagent.contracts.sqlworkbench.SqlValidationReport;

public record SqlAssistantPrompt(
    SqlAssistantAction assistantAction,
    String connectionId,
    String targetEnvironment,
    String schema,
    String platformType,
    String sql,
    SqlValidationReport validationReport,
    String diagnosticContext) {
}
