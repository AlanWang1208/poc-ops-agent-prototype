package com.company.opsagent.executionworker;

import static org.junit.jupiter.api.Assertions.assertEquals;

import com.company.opsagent.contracts.sqlworkbench.SqlQueryAction;
import com.company.opsagent.contracts.sqlworkbench.SqlQueryExecutionRequest;
import com.company.opsagent.contracts.sqlworkbench.SqlQueryLimits;
import com.company.opsagent.contracts.sqlworkbench.SqlQueryRequest;
import com.company.opsagent.contracts.workflow.OperatorContext;
import com.company.opsagent.contracts.workflow.PolicyDecisionReference;
import com.company.opsagent.contracts.workflow.TraceContext;
import java.time.Clock;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.List;
import org.junit.jupiter.api.Test;

class RestrictedSqlQueryExecutionWorkerTest {

  private static final Clock CLOCK = Clock.fixed(Instant.parse("2026-06-12T00:00:00Z"), ZoneOffset.UTC);

  @Test
  void rejectsDmlHiddenInsideReadOnlyExecutionEnvelope() {
    var worker = new RestrictedSqlQueryExecutionWorker(new CalciteSqlReadOnlyGuard(), request -> "result-1", CLOCK);

    var result = worker.execute(request("update ORDERS.ORDERS set status = 'READY'", "development", 30));

    assertEquals("REJECTED", result.status());
    assertEquals("SQL_NOT_READ_ONLY", result.errorCode());
  }

  @Test
  void rejectsExpiredRequest() {
    var worker = new RestrictedSqlQueryExecutionWorker(new CalciteSqlReadOnlyGuard(), request -> "result-1", CLOCK);

    var result = worker.execute(request("select * from ORDERS.ORDERS", "development", -1));

    assertEquals("REJECTED", result.status());
    assertEquals("REQUEST_EXPIRED", result.errorCode());
  }

  @Test
  void acceptsValidatedSelect() {
    var worker = new RestrictedSqlQueryExecutionWorker(new CalciteSqlReadOnlyGuard(), request -> "result-1", CLOCK);

    var result = worker.execute(request("select * from ORDERS.ORDERS", "development", 30));

    assertEquals("SUCCEEDED", result.status());
    assertEquals("result-1", result.resultId());
  }

  private SqlQueryExecutionRequest request(String sql, String environment, int expiresInSeconds) {
    var query = new SqlQueryRequest(
        "1.0",
        "as400-development",
        environment,
        "ORDERS",
        SqlQueryAction.RUN_READ_ONLY,
        sql,
        List.of(),
        new SqlQueryLimits(500, 5_000_000, 30),
        "key");
    return new SqlQueryExecutionRequest(
        "1.0",
        "execution-1",
        "workflow-1",
        query,
        "sha256:test",
        new OperatorContext("operator-1", List.of("ROLE_ops-reader")),
        new PolicyDecisionReference("decision-1", "policy-v1", "ALLOW"),
        new TraceContext("trace-1", "request-1"),
        OffsetDateTime.now(CLOCK).plusSeconds(expiresInSeconds));
  }
}
