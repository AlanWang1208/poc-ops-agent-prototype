package com.company.opsagent.controlplane.bootstrap.api;

import com.fasterxml.jackson.databind.JsonNode;

/**
 * 操作员发起只读诊断的 API 请求。
 */
public record ReadOnlyDiagnosticRequest(
    String workspaceId,
    String skillId,
    String targetEnvironment,
    String idempotencyKey,
    JsonNode parameters) {
}
