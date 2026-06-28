package com.company.opsagent.controlplane.modules.sqlworkbench;

import com.company.opsagent.contracts.sqlworkbench.SqlConnectionSummary;
import com.company.opsagent.contracts.sqlworkbench.SqlConnectionCreateRequest;
import com.company.opsagent.contracts.sqlworkbench.SqlConnectionUpdateRequest;
import java.util.List;
import java.util.Optional;

/**
 * SQL 工作台可发现连接的只读目录。
 */
public interface SqlConnectionCatalog {

  List<SqlConnectionSummary> list();

  Optional<SqlConnectionSummary> find(String connectionId);

  SqlConnectionSummary create(SqlConnectionCreateRequest request);

  SqlConnectionSummary update(String connectionId, SqlConnectionUpdateRequest request);

  void delete(String connectionId);

  SqlConnectionSummary updateStatus(String connectionId, String status);
}
