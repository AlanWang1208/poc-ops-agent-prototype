package com.company.opsagent.controlplane.bootstrap.api;

import java.util.Map;

/**
 * Request accepted by the server-authorized primary Agent diagnostic endpoint.
 */
public record AgentDiagnosticRequest(
    String targetEnvironment,
    String idempotencyKey,
    String userIntent,
    Map<String, String> inputParameters) {
}
