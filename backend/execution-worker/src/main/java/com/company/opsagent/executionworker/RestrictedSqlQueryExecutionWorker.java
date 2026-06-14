package com.company.opsagent.executionworker;

import com.company.opsagent.contracts.sqlworkbench.SqlQueryExecutionRequest;
import com.company.opsagent.contracts.sqlworkbench.SqlQueryExecutionResult;
import java.time.Clock;
import java.time.OffsetDateTime;

/**
 * SQL 查询专用受限 Worker，只接受未过期的开发测试环境 SELECT。
 */
public class RestrictedSqlQueryExecutionWorker {

  private final SqlReadOnlyGuard readOnlyGuard;
  private final SqlQueryExecutor executor;
  private final Clock clock;

  public RestrictedSqlQueryExecutionWorker(
      SqlReadOnlyGuard readOnlyGuard,
      SqlQueryExecutor executor,
      Clock clock) {
    this.readOnlyGuard = readOnlyGuard;
    this.executor = executor;
    this.clock = clock;
  }

  public SqlQueryExecutionResult execute(SqlQueryExecutionRequest request) {
    if (!request.expiresAt().isAfter(OffsetDateTime.now(clock))) {
      return rejected(request, "REQUEST_EXPIRED", "execution request has expired");
    }
    if ("production".equalsIgnoreCase(request.query().targetEnvironment())) {
      return rejected(request, "PRODUCTION_NOT_ALLOWED", "production SQL connections are prohibited");
    }
    if (!readOnlyGuard.isReadOnly(request.query().sql())) {
      return rejected(request, "SQL_NOT_READ_ONLY", "Worker accepts exactly one SELECT statement");
    }
    try {
      String resultId = executor.execute(request);
      return new SqlQueryExecutionResult(
          "1.0",
          request.executionRequestId(),
          request.workflowId(),
          "SUCCEEDED",
          resultId,
          null,
          null);
    } catch (RuntimeException exception) {
      return new SqlQueryExecutionResult(
          "1.0",
          request.executionRequestId(),
          request.workflowId(),
          "FAILED",
          null,
          "SQL_EXECUTION_FAILED",
          "SQL query execution failed");
    }
  }

  private SqlQueryExecutionResult rejected(
      SqlQueryExecutionRequest request,
      String code,
      String message) {
    return new SqlQueryExecutionResult(
        "1.0",
        request.executionRequestId(),
        request.workflowId(),
        "REJECTED",
        null,
        code,
        message);
  }
}
