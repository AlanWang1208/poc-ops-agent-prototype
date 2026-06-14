package com.company.opsagent.controlplane.modules.sqlworkbench;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import com.company.opsagent.contracts.sqlworkbench.SqlConnectionSummary;
import com.company.opsagent.contracts.sqlworkbench.SqlQueryAction;
import com.company.opsagent.contracts.sqlworkbench.SqlQueryLimits;
import com.company.opsagent.contracts.sqlworkbench.SqlQueryRequest;
import com.company.opsagent.contracts.sqlworkbench.SqlValidationLevel;
import java.util.List;
import org.junit.jupiter.api.Test;

class DefaultSqlWorkbenchServiceTest {

  private final DefaultSqlWorkbenchService service = new DefaultSqlWorkbenchService(
      new InMemorySqlConnectionCatalog(List.of(new SqlConnectionSummary(
          "1.0",
          "as400-development",
          "AS/400 Development",
          "development",
          "DB2_FOR_I",
          List.of("ORDERS"),
          List.of(SqlQueryAction.VALIDATE, SqlQueryAction.RUN_READ_ONLY, SqlQueryAction.PREFLIGHT_DML)))),
      new CalciteSqlValidationService());

  @Test
  void rejectsSchemaOutsideConnectionAllowList() {
    assertThrows(IllegalArgumentException.class, () -> service.validate(request("FINANCE")));
  }

  @Test
  void validatesAllowedRequest() {
    assertEquals(SqlValidationLevel.VALIDATED, service.validate(request("ORDERS")).validationLevel());
  }

  @Test
  void rejectsSqlThatReferencesAnotherSchema() {
    SqlQueryRequest request = request("ORDERS");
    var crossSchemaRequest = new SqlQueryRequest(
        request.contractVersion(),
        request.connectionId(),
        request.targetEnvironment(),
        request.schema(),
        request.action(),
        "select * from FINANCE.PAYROLL",
        request.parameters(),
        request.limits(),
        request.idempotencyKey());

    assertThrows(IllegalArgumentException.class, () -> service.validate(crossSchemaRequest));
  }

  private SqlQueryRequest request(String schema) {
    return new SqlQueryRequest(
        "1.0",
        "as400-development",
        "development",
        schema,
        SqlQueryAction.RUN_READ_ONLY,
        "select * from ORDERS.ORDERS",
        List.of(),
        new SqlQueryLimits(500, 5_000_000, 30),
        "key");
  }
}
