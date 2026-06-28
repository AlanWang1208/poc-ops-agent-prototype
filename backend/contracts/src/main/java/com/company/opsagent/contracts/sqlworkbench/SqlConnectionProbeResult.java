package com.company.opsagent.contracts.sqlworkbench;

import static com.company.opsagent.contracts.ContractValues.requiredText;

import java.time.OffsetDateTime;
import java.util.Set;

/**
 * Worker 探测 SQL 连接后的稳定状态契约。
 */
public record SqlConnectionProbeResult(
    String contractVersion,
    String connectionId,
    String status,
    String message,
    OffsetDateTime probedAt) {

  private static final Set<String> STATUSES = Set.of(
      "READY",
      "CREDENTIAL_ALIAS_NOT_FOUND",
      "CREDENTIAL_LOCKED",
      "EGRESS_NOT_ALLOWED",
      "READ_ONLY_ACCOUNT_CHECK_FAILED",
      "PROBE_FAILED");

  public SqlConnectionProbeResult {
    if (!"1.0".equals(contractVersion)) {
      throw new IllegalArgumentException("contractVersion must be 1.0");
    }
    connectionId = requiredText(connectionId, "connectionId");
    status = requiredText(status, "status");
    if (!STATUSES.contains(status)) {
      throw new IllegalArgumentException("unsupported SQL connection probe status");
    }
    if (probedAt == null) {
      throw new IllegalArgumentException("probedAt must not be null");
    }
  }
}
