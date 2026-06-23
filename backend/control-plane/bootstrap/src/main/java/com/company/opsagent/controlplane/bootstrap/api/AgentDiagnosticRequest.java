package com.company.opsagent.controlplane.bootstrap.api;

import java.util.Map;

/**
 * 服务端授权后的主 Agent 只读诊断入口所接收的请求体。
 */
public record AgentDiagnosticRequest(
    String targetEnvironment,
    String idempotencyKey,
    String userIntent,
    Map<String, String> inputParameters) {
}
