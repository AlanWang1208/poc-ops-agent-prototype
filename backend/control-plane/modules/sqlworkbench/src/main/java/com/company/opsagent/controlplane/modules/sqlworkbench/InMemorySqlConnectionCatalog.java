package com.company.opsagent.controlplane.modules.sqlworkbench;

import com.company.opsagent.contracts.sqlworkbench.SqlConnectionSummary;
import java.util.List;
import java.util.Optional;

/**
 * P1 的受控连接目录实现，生产连接不会进入目录。
 */
public class InMemorySqlConnectionCatalog implements SqlConnectionCatalog {

  private final List<SqlConnectionSummary> connections;

  public InMemorySqlConnectionCatalog(List<SqlConnectionSummary> connections) {
    this.connections = List.copyOf(connections);
  }

  @Override
  public List<SqlConnectionSummary> list() {
    return connections;
  }

  @Override
  public Optional<SqlConnectionSummary> find(String connectionId) {
    return connections.stream().filter(connection -> connection.connectionId().equals(connectionId)).findFirst();
  }
}
