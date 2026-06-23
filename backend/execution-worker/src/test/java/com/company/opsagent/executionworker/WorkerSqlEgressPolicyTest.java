package com.company.opsagent.executionworker;

import static org.junit.jupiter.api.Assertions.assertEquals;
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
import org.junit.jupiter.api.Test;

/**
 * 验证 Worker 在解析 SQL 连接前执行本地出口 allowlist。
 */
class WorkerSqlEgressPolicyTest {

  /**
   * 验证配置内的开发环境连接可以通过出口策略。
   */
  @Test
  void allowsConfiguredDevelopmentConnection() {
    WorkerSqlConnectionDescriptor descriptor = policy().validate(request("as400-dev-readonly", "development"));

    assertEquals("as400-dev-readonly", descriptor.connectionId());
  }

  /**
   * 验证未知连接标识不会落到默认连接或真实网络调用。
   */
  @Test
  void rejectsUnknownConnection() {
    WorkerSqlEgressException exception = assertThrows(
        WorkerSqlEgressException.class,
        () -> policy().validate(request("missing", "development")));

    assertEquals("SQL_CONNECTION_NOT_FOUND", exception.errorCode());
  }

  /**
   * 验证显式禁用的连接目录项不能被执行。
   */
  @Test
  void rejectsDisabledConnection() {
    WorkerSqlEgressException exception = assertThrows(
        WorkerSqlEgressException.class,
        () -> policy(List.of(disabledDescriptor()), allowedTargets()).validate(request("as400-disabled", "development")));

    assertEquals("SQL_CONNECTION_DISABLED", exception.errorCode());
  }

  /**
   * 验证请求环境必须与连接目录声明一致。
   */
  @Test
  void rejectsEnvironmentMismatch() {
    WorkerSqlEgressException exception = assertThrows(
        WorkerSqlEgressException.class,
        () -> policy().validate(request("as400-dev-readonly", "test")));

    assertEquals("SQL_ENVIRONMENT_MISMATCH", exception.errorCode());
  }

  /**
   * 验证连接目录中的主机或端口不在 Worker allowlist 时会被拒绝。
   */
  @Test
  void rejectsHostOrPortOutsideAllowlist() {
    WorkerSqlEgressException exception = assertThrows(
        WorkerSqlEgressException.class,
        () -> policy(List.of(descriptor()), List.of(new WorkerSqlEgressTarget("other.internal", 446)))
            .validate(request("as400-dev-readonly", "development")));

    assertEquals("SQL_EGRESS_NOT_ALLOWED", exception.errorCode());
  }

  private WorkerSqlEgressPolicy policy() {
    return policy(List.of(descriptor()), allowedTargets());
  }

  private WorkerSqlEgressPolicy policy(
      List<WorkerSqlConnectionDescriptor> descriptors,
      List<WorkerSqlEgressTarget> targets) {
    return new WorkerSqlEgressPolicy(descriptors, targets);
  }

  private List<WorkerSqlEgressTarget> allowedTargets() {
    return List.of(new WorkerSqlEgressTarget("as400-dev.internal", 446));
  }

  private WorkerSqlConnectionDescriptor descriptor() {
    return new WorkerSqlConnectionDescriptor(
        "as400-dev-readonly", "development", "as400-dev.internal", 446, "as400-dev-readonly", true);
  }

  private WorkerSqlConnectionDescriptor disabledDescriptor() {
    return new WorkerSqlConnectionDescriptor(
        "as400-disabled", "development", "as400-dev.internal", 446, "as400-dev-readonly", false);
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
