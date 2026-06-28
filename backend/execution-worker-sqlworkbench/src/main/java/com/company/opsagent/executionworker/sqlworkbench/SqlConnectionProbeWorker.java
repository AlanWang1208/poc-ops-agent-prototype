package com.company.opsagent.executionworker.sqlworkbench;

import com.company.opsagent.contracts.sqlworkbench.SqlConnectionProbeResult;
import com.company.opsagent.contracts.sqlworkbench.SqlConnectionSummary;
import java.time.Clock;
import java.time.OffsetDateTime;
import java.util.Arrays;

/**
 * Worker 侧 SQL 连接探测，只依赖本地连接目录、出口 allowlist 和凭据别名。
 */
public class SqlConnectionProbeWorker {

  private final WorkerSqlEgressPolicy egressPolicy;
  private final SqlPasswordProvider passwordProvider;
  private final Clock clock;

  public SqlConnectionProbeWorker(
      WorkerSqlEgressPolicy egressPolicy,
      SqlPasswordProvider passwordProvider,
      Clock clock) {
    this.egressPolicy = egressPolicy;
    this.passwordProvider = passwordProvider;
    this.clock = clock;
  }

  public SqlConnectionProbeResult probe(SqlConnectionSummary connection) {
    try {
      WorkerSqlConnectionDescriptor descriptor = egressPolicy.validate(connection);
      char[] password = passwordProvider.password(descriptor.credentialAlias());
      Arrays.fill(password, '\0');
      return result(connection, "READY", "SQL connection probe succeeded");
    } catch (WorkerSqlEgressException exception) {
      return result(connection, mapEgressStatus(exception), exception.getMessage());
    } catch (IllegalArgumentException exception) {
      return result(connection, "CREDENTIAL_ALIAS_NOT_FOUND", "SQL credential alias is not available");
    } catch (IllegalStateException exception) {
      return result(connection, "CREDENTIAL_LOCKED", "SQL credential store could not be unlocked");
    } catch (RuntimeException exception) {
      return result(connection, "PROBE_FAILED", "SQL connection probe failed");
    }
  }

  private String mapEgressStatus(WorkerSqlEgressException exception) {
    if ("SQL_CONNECTION_NOT_FOUND".equals(exception.errorCode())
        || "SQL_CREDENTIAL_ALIAS_MISMATCH".equals(exception.errorCode())) {
      return "CREDENTIAL_ALIAS_NOT_FOUND";
    }
    return "EGRESS_NOT_ALLOWED";
  }

  private SqlConnectionProbeResult result(SqlConnectionSummary connection, String status, String message) {
    return new SqlConnectionProbeResult(
        "1.0",
        connection.connectionId(),
        status,
        message,
        OffsetDateTime.now(clock));
  }
}
