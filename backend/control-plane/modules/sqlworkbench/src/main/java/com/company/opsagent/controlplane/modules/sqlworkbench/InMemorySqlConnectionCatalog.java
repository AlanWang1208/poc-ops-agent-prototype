package com.company.opsagent.controlplane.modules.sqlworkbench;

import com.company.opsagent.contracts.sqlworkbench.SqlConnectionCreateRequest;
import com.company.opsagent.contracts.sqlworkbench.SqlConnectionSummary;
import com.company.opsagent.contracts.sqlworkbench.SqlConnectionUpdateRequest;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.regex.Pattern;

/**
 * P1 的受控连接目录实现，生产连接不会进入目录。
 */
public class InMemorySqlConnectionCatalog implements SqlConnectionCatalog {

  private static final Pattern NON_ALPHANUMERIC = Pattern.compile("[^a-z0-9]+");

  private final Map<String, SqlConnectionSummary> connections;

  public InMemorySqlConnectionCatalog(List<SqlConnectionSummary> connections) {
    this.connections = new LinkedHashMap<>();
    for (SqlConnectionSummary connection : connections) {
      this.connections.put(connection.connectionId(), connection);
    }
  }

  @Override
  public synchronized List<SqlConnectionSummary> list() {
    return List.copyOf(connections.values());
  }

  @Override
  public synchronized Optional<SqlConnectionSummary> find(String connectionId) {
    return Optional.ofNullable(connections.get(connectionId));
  }

  @Override
  public synchronized SqlConnectionSummary create(SqlConnectionCreateRequest request) {
    String connectionId = uniqueConnectionId(request.displayName());
    SqlConnectionSummary summary = new SqlConnectionSummary(
        "1.0",
        connectionId,
        request.displayName(),
        request.targetEnvironment(),
        request.platformType(),
        request.host(),
        request.port(),
        request.defaultSchema(),
        request.allowedSchemas(),
        request.capabilities(),
        request.credentialAlias(),
        "PENDING_WORKER_BINDING",
        request.maxRowsDefault(),
        request.timeoutSecondsDefault());
    connections.put(connectionId, summary);
    return summary;
  }

  @Override
  public synchronized SqlConnectionSummary update(String connectionId, SqlConnectionUpdateRequest request) {
    if (!connections.containsKey(connectionId)) {
      throw new IllegalArgumentException("SQL connection is not available");
    }
    SqlConnectionSummary summary = new SqlConnectionSummary(
        "1.0",
        connectionId,
        request.displayName(),
        request.targetEnvironment(),
        request.platformType(),
        request.host(),
        request.port(),
        request.defaultSchema(),
        request.allowedSchemas(),
        request.capabilities(),
        request.credentialAlias(),
        "PENDING_WORKER_BINDING",
        request.maxRowsDefault(),
        request.timeoutSecondsDefault());
    connections.put(connectionId, summary);
    return summary;
  }

  @Override
  public synchronized void delete(String connectionId) {
    if (connections.remove(connectionId) == null) {
      throw new IllegalArgumentException("SQL connection is not available");
    }
  }

  @Override
  public synchronized SqlConnectionSummary updateStatus(String connectionId, String status) {
    SqlConnectionSummary current = find(connectionId)
        .orElseThrow(() -> new IllegalArgumentException("SQL connection is not available"));
    SqlConnectionSummary updated = new SqlConnectionSummary(
        current.contractVersion(),
        current.connectionId(),
        current.displayName(),
        current.targetEnvironment(),
        current.platformType(),
        current.host(),
        current.port(),
        current.defaultSchema(),
        current.allowedSchemas(),
        current.capabilities(),
        current.credentialAlias(),
        status,
        current.maxRowsDefault(),
        current.timeoutSecondsDefault());
    connections.put(connectionId, updated);
    return updated;
  }

  private String uniqueConnectionId(String displayName) {
    String base = NON_ALPHANUMERIC.matcher(displayName.toLowerCase()).replaceAll("-")
        .replaceAll("^-|-$", "");
    if (base.isBlank()) {
      base = "sql-connection";
    }
    String candidate = base;
    int suffix = 2;
    while (connections.containsKey(candidate)) {
      candidate = base + "-" + suffix;
      suffix++;
    }
    return candidate;
  }
}
