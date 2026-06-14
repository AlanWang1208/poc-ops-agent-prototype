package com.company.opsagent.controlplane.modules.sqlworkbench;

import com.company.opsagent.contracts.sqlworkbench.SqlQueryRequest;
import com.company.opsagent.contracts.sqlworkbench.SqlValidationReport;

/**
 * SQL 工作台的服务端校验边界。
 */
public interface SqlValidationService {

  SqlValidationReport validate(SqlQueryRequest request);
}
