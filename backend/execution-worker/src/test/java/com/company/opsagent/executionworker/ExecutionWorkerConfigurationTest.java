package com.company.opsagent.executionworker;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;

import com.company.opsagent.contracts.sqlworkbench.SqlQueryAction;
import com.company.opsagent.contracts.sqlworkbench.SqlQueryExecutionRequest;
import com.company.opsagent.contracts.sqlworkbench.SqlQueryLimits;
import com.company.opsagent.contracts.sqlworkbench.SqlQueryRequest;
import com.company.opsagent.contracts.workflow.OperatorContext;
import com.company.opsagent.contracts.workflow.PolicyDecisionReference;
import com.company.opsagent.contracts.workflow.TraceContext;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.time.OffsetDateTime;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;

/**
 * 验证 Worker 默认装配会启用 SQL 出口 allowlist，且空配置默认拒绝。
 */
class ExecutionWorkerConfigurationTest {

  private final ApplicationContextRunner contextRunner = new ApplicationContextRunner()
      .withUserConfiguration(ExecutionWorkerConfiguration.class)
      .withBean(ObjectMapper.class, ObjectMapper::new);

  /**
   * 验证默认配置注册 SQL 出口策略，并在没有连接目录时拒绝 SQL 请求。
   */
  @Test
  void registersSqlEgressPolicyWithEmptyDefaultDeny() {
    contextRunner.run(context -> {
      assertNotNull(context.getBean(WorkerSqlEgressProperties.class));
      assertNotNull(context.getBean(WorkerSqlEgressPolicy.class));

      var worker = context.getBean(RestrictedSqlQueryExecutionWorker.class);
      var result = worker.execute(request());

      assertEquals("REJECTED", result.status());
      assertEquals("SQL_CONNECTION_NOT_FOUND", result.errorCode());
    });
  }

  private SqlQueryExecutionRequest request() {
    var query = new SqlQueryRequest(
        "1.0",
        "as400-development",
        "development",
        "ORDERS",
        SqlQueryAction.RUN_READ_ONLY,
        "select * from ORDERS.ORDERS",
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
        OffsetDateTime.now().plusSeconds(30));
  }
}
