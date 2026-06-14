package com.company.opsagent.controlplane.modules.sqlworkbench;

import com.company.opsagent.contracts.sqlworkbench.SqlConnectionSummary;
import com.company.opsagent.contracts.sqlworkbench.SqlQueryRequest;
import com.company.opsagent.contracts.sqlworkbench.SqlValidationReport;
import java.util.List;

/**
 * SQL 工作台应用服务，先校验连接目录边界，再委托 AST 校验。
 */
public class DefaultSqlWorkbenchService implements SqlWorkbenchService {

  private final SqlConnectionCatalog connectionCatalog;
  private final SqlValidationService validationService;

  public DefaultSqlWorkbenchService(
      SqlConnectionCatalog connectionCatalog,
      SqlValidationService validationService) {
    this.connectionCatalog = connectionCatalog;
    this.validationService = validationService;
  }

  @Override
  public List<SqlConnectionSummary> listConnections() {
    return connectionCatalog.list();
  }

  @Override
  public SqlValidationReport validate(SqlQueryRequest request) {
    SqlConnectionSummary connection = connectionCatalog.find(request.connectionId())
        .orElseThrow(() -> new IllegalArgumentException("SQL connection is not available"));
    if (!connection.targetEnvironment().equalsIgnoreCase(request.targetEnvironment())) {
      throw new IllegalArgumentException("target environment does not match connection");
    }
    boolean schemaAllowed = connection.allowedSchemas().stream()
        .anyMatch(schema -> schema.equalsIgnoreCase(request.schema()));
    if (!schemaAllowed) {
      throw new IllegalArgumentException("schema is not allowed for connection");
    }
    if (!connection.capabilities().contains(request.action())) {
      throw new IllegalArgumentException("action is not allowed for connection");
    }
    SqlValidationReport report = validationService.validate(request);
    boolean crossSchemaReference = report.referencedObjects().stream()
        .filter(object -> object.contains("."))
        .map(object -> object.substring(0, object.indexOf('.')))
        .anyMatch(referencedSchema -> connection.allowedSchemas().stream()
            .noneMatch(allowed -> allowed.equalsIgnoreCase(referencedSchema)));
    if (crossSchemaReference) {
      throw new IllegalArgumentException("SQL references a schema outside the connection allow list");
    }
    return report;
  }
}
