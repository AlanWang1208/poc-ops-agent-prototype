package com.company.opsagent.controlplane.modules.sqlworkbench;

import com.company.opsagent.contracts.sqlworkbench.SqlConnectionSummary;
import com.company.opsagent.contracts.sqlworkbench.SqlQueryRequest;
import com.company.opsagent.contracts.sqlworkbench.SqlValidationReport;
import java.util.List;

/**
 * SQL 工作台公开给控制面 API 的应用边界。
 */
public interface SqlWorkbenchService {

  List<SqlConnectionSummary> listConnections();

  SqlValidationReport validate(SqlQueryRequest request);
}
