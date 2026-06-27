package com.company.opsagent.executionworker.sqlworkbench;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertThrows;

import com.company.opsagent.contracts.sqlworkbench.SqlQueryAction;
import com.company.opsagent.contracts.sqlworkbench.SqlQueryExecutionRequest;
import com.company.opsagent.contracts.sqlworkbench.SqlQueryLimits;
import com.company.opsagent.contracts.sqlworkbench.SqlQueryRequest;
import com.company.opsagent.contracts.workflow.OperatorContext;
import com.company.opsagent.contracts.workflow.PolicyDecisionReference;
import com.company.opsagent.contracts.workflow.TraceContext;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.concurrent.atomic.AtomicBoolean;
import javax.sql.DataSource;
import org.h2.jdbcx.JdbcDataSource;
import org.junit.jupiter.api.Test;

/**
 * 验证数据源注册表必须先执行 Worker 本地出口策略，再解析 JDBC 数据源。
 */
class PolicyEnforcedSqlDataSourceRegistryTest {

  /**
   * 验证策略允许后才把请求交给真实数据源注册表。
   */
  @Test
  void delegatesOnlyAfterPolicyAllowsRequest() {
    JdbcDataSource dataSource = new JdbcDataSource();
    var registry = new PolicyEnforcedSqlDataSourceRegistry(policy(), request -> dataSource);

    DataSource resolved = registry.resolve(request("as400-dev-readonly", "development"));

    assertSame(dataSource, resolved);
  }

  /**
   * 验证策略拒绝时不会解析真实数据源，避免默认连接或真实网络调用。
   */
  @Test
  void doesNotDelegateWhenPolicyRejectsRequest() {
    AtomicBoolean called = new AtomicBoolean(false);
    var registry = new PolicyEnforcedSqlDataSourceRegistry(policy(), request -> {
      called.set(true);
      return new JdbcDataSource();
    });

    assertThrows(WorkerSqlEgressException.class, () -> registry.resolve(request("missing", "development")));
    assertFalse(called.get());
  }

  private WorkerSqlEgressPolicy policy() {
    return new WorkerSqlEgressPolicy(
        List.of(new WorkerSqlConnectionDescriptor(
            "as400-dev-readonly", "development", "as400-dev.internal", 446, "as400-dev-readonly", true)),
        List.of(new WorkerSqlEgressTarget("as400-dev.internal", 446)));
  }

  private SqlQueryExecutionRequest request(String connectionId, String environment) {
    var query = new SqlQueryRequest(
        "1.0",
        connectionId,
        environment,
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
