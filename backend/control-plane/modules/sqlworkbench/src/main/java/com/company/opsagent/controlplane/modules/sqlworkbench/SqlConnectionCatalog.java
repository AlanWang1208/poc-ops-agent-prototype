package com.company.opsagent.controlplane.modules.sqlworkbench;

import com.company.opsagent.contracts.sqlworkbench.SqlConnectionSummary;
import java.util.List;
import java.util.Optional;

/**
 * SQL 工作台可发现连接的只读目录。
 */
public interface SqlConnectionCatalog {

  List<SqlConnectionSummary> list();

  Optional<SqlConnectionSummary> find(String connectionId);
}
