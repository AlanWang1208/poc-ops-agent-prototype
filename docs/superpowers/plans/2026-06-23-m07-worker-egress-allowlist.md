# M07 Worker Egress Allowlist Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a locally testable M07 SQL egress allowlist so the Worker only resolves approved development or test SQL targets before opening JDBC connections.

**Architecture:** Keep the policy inside `backend/execution-worker`, not in the control plane or frontend. Extend `SqlDataSourceRegistry` to resolve from the full `SqlQueryExecutionRequest`, add a policy-enforced registry wrapper, and map policy denials to stable `REJECTED` SQL execution results.

**Tech Stack:** Java 21, Spring Boot configuration properties, Maven, JUnit 5, existing execution-worker module and contracts.

---

## File Structure

- Create `backend/execution-worker/src/main/java/com/company/opsagent/executionworker/WorkerSqlEgressTarget.java` for allowed host/port pairs.
- Create `backend/execution-worker/src/main/java/com/company/opsagent/executionworker/WorkerSqlConnectionDescriptor.java` for configured SQL connection metadata.
- Create `backend/execution-worker/src/main/java/com/company/opsagent/executionworker/WorkerSqlEgressException.java` for stable policy rejection codes.
- Create `backend/execution-worker/src/main/java/com/company/opsagent/executionworker/WorkerSqlEgressPolicy.java` for connection lookup and allowlist validation.
- Create `backend/execution-worker/src/main/java/com/company/opsagent/executionworker/PolicyEnforcedSqlDataSourceRegistry.java` for enforcing policy before delegating to a real registry.
- Create `backend/execution-worker/src/main/java/com/company/opsagent/executionworker/WorkerSqlEgressProperties.java` for local Worker configuration binding.
- Modify `backend/execution-worker/src/main/java/com/company/opsagent/executionworker/SqlDataSourceRegistry.java` to accept `SqlQueryExecutionRequest` instead of only `connectionId`.
- Modify `backend/execution-worker/src/main/java/com/company/opsagent/executionworker/JdbcSqlQueryExecutor.java` to call `resolve(request)`.
- Modify `backend/execution-worker/src/main/java/com/company/opsagent/executionworker/RestrictedSqlQueryExecutionWorker.java` to map `WorkerSqlEgressException` to `REJECTED`.
- Modify `backend/execution-worker/src/main/java/com/company/opsagent/executionworker/ExecutionWorkerConfiguration.java` and `backend/execution-worker/src/main/resources/application.yaml` to register empty P1 egress properties.
- Create tests in `backend/execution-worker/src/test/java/com/company/opsagent/executionworker/` for descriptors, policy, policy-enforced registry, and worker rejection mapping.
- Update `backend/execution-worker/README.md`, `docs/runbooks/m07-worker-transport-auth.md`, `docs/standards/p1-threat-model.md`, `docs/planning/project-plan.md`, and `docs/planning/p1-read-only-vertical-slice-evidence.md`.

## Task 1: Add Egress Descriptor Validation

**Files:**
- Create: `backend/execution-worker/src/test/java/com/company/opsagent/executionworker/WorkerSqlConnectionDescriptorTest.java`
- Create: `backend/execution-worker/src/main/java/com/company/opsagent/executionworker/WorkerSqlEgressTarget.java`
- Create: `backend/execution-worker/src/main/java/com/company/opsagent/executionworker/WorkerSqlConnectionDescriptor.java`

- [ ] **Step 1: Write the failing descriptor test**

```java
package com.company.opsagent.executionworker;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import org.junit.jupiter.api.Test;

class WorkerSqlConnectionDescriptorTest {

  @Test
  void acceptsDevelopmentConnectionDescriptor() {
    var descriptor = new WorkerSqlConnectionDescriptor(
        "as400-dev-readonly",
        "development",
        "as400-dev.internal",
        446,
        "as400-dev-readonly",
        true);

    assertEquals("as400-dev-readonly", descriptor.connectionId());
    assertEquals("development", descriptor.targetEnvironment());
    assertEquals("as400-dev.internal", descriptor.host());
    assertEquals(446, descriptor.port());
  }

  @Test
  void rejectsProductionConnectionDescriptor() {
    assertThrows(IllegalArgumentException.class, () -> new WorkerSqlConnectionDescriptor(
        "as400-prod-readonly",
        "production",
        "as400-prod.internal",
        446,
        "as400-prod-readonly",
        true));
  }

  @Test
  void rejectsInvalidPort() {
    assertThrows(IllegalArgumentException.class, () -> new WorkerSqlEgressTarget("as400-dev.internal", 0));
    assertThrows(IllegalArgumentException.class, () -> new WorkerSqlConnectionDescriptor(
        "as400-dev-readonly",
        "development",
        "as400-dev.internal",
        70000,
        "as400-dev-readonly",
        true));
  }
}
```

- [ ] **Step 2: Run the descriptor test to verify RED**

Run:

```powershell
.\mvnw.cmd -pl execution-worker -am -Dtest=WorkerSqlConnectionDescriptorTest "-Dsurefire.failIfNoSpecifiedTests=false" test
```

Expected: compilation fails because `WorkerSqlConnectionDescriptor` and `WorkerSqlEgressTarget` do not exist.

- [ ] **Step 3: Add the minimal descriptor records**

```java
package com.company.opsagent.executionworker;

/**
 * Worker 允许访问的单个 SQL 网络出口目标。
 */
public record WorkerSqlEgressTarget(String host, int port) {

  public WorkerSqlEgressTarget {
    host = requiredText(host, "host").toLowerCase();
    if (port < 1 || port > 65535) {
      throw new IllegalArgumentException("port must be between 1 and 65535");
    }
  }

  private static String requiredText(String value, String name) {
    if (value == null || value.isBlank()) {
      throw new IllegalArgumentException(name + " is required");
    }
    return value.trim();
  }
}
```

```java
package com.company.opsagent.executionworker;

/**
 * Worker 本地 SQL 连接目录项，只保存连接元数据和凭据别名，不保存真实密钥。
 */
public record WorkerSqlConnectionDescriptor(
    String connectionId,
    String targetEnvironment,
    String host,
    int port,
    String credentialAlias,
    boolean enabled) {

  public WorkerSqlConnectionDescriptor {
    connectionId = requiredText(connectionId, "connectionId");
    targetEnvironment = requiredText(targetEnvironment, "targetEnvironment").toLowerCase();
    if (!"development".equals(targetEnvironment) && !"test".equals(targetEnvironment)) {
      throw new IllegalArgumentException("targetEnvironment must be development or test");
    }
    host = requiredText(host, "host").toLowerCase();
    if (port < 1 || port > 65535) {
      throw new IllegalArgumentException("port must be between 1 and 65535");
    }
    credentialAlias = requiredText(credentialAlias, "credentialAlias");
  }

  public WorkerSqlEgressTarget target() {
    return new WorkerSqlEgressTarget(host, port);
  }

  private static String requiredText(String value, String name) {
    if (value == null || value.isBlank()) {
      throw new IllegalArgumentException(name + " is required");
    }
    return value.trim();
  }
}
```

- [ ] **Step 4: Run the descriptor test to verify GREEN**

Run the same Maven command. Expected: `Tests run: 3, Failures: 0, Errors: 0`.

## Task 2: Add Worker SQL Egress Policy

**Files:**
- Create: `backend/execution-worker/src/test/java/com/company/opsagent/executionworker/WorkerSqlEgressPolicyTest.java`
- Create: `backend/execution-worker/src/main/java/com/company/opsagent/executionworker/WorkerSqlEgressException.java`
- Create: `backend/execution-worker/src/main/java/com/company/opsagent/executionworker/WorkerSqlEgressPolicy.java`

- [ ] **Step 1: Write the failing policy test**

```java
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

class WorkerSqlEgressPolicyTest {

  @Test
  void allowsConfiguredDevelopmentConnection() {
    WorkerSqlConnectionDescriptor descriptor = policy().validate(request("as400-dev-readonly", "development"));

    assertEquals("as400-dev-readonly", descriptor.connectionId());
  }

  @Test
  void rejectsUnknownConnection() {
    WorkerSqlEgressException exception = assertThrows(
        WorkerSqlEgressException.class,
        () -> policy().validate(request("missing", "development")));

    assertEquals("SQL_CONNECTION_NOT_FOUND", exception.errorCode());
  }

  @Test
  void rejectsDisabledConnection() {
    WorkerSqlEgressException exception = assertThrows(
        WorkerSqlEgressException.class,
        () -> policy(List.of(disabledDescriptor()), allowedTargets()).validate(request("as400-disabled", "development")));

    assertEquals("SQL_CONNECTION_DISABLED", exception.errorCode());
  }

  @Test
  void rejectsEnvironmentMismatch() {
    WorkerSqlEgressException exception = assertThrows(
        WorkerSqlEgressException.class,
        () -> policy().validate(request("as400-dev-readonly", "test")));

    assertEquals("SQL_ENVIRONMENT_MISMATCH", exception.errorCode());
  }

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
```

- [ ] **Step 2: Run the policy test to verify RED**

Run:

```powershell
.\mvnw.cmd -pl execution-worker -am -Dtest=WorkerSqlEgressPolicyTest "-Dsurefire.failIfNoSpecifiedTests=false" test
```

Expected: compilation fails because `WorkerSqlEgressPolicy` and `WorkerSqlEgressException` do not exist.

- [ ] **Step 3: Add minimal policy implementation**

Implement `WorkerSqlEgressException` with `errorCode()` and `safeMessage()`. Implement `WorkerSqlEgressPolicy` by indexing descriptors by `connectionId` and checking enabled flag, environment equality, and allowlist target membership before returning the descriptor.

- [ ] **Step 4: Run the policy test to verify GREEN**

Run the same Maven command. Expected: `Tests run: 5, Failures: 0, Errors: 0`.

## Task 3: Enforce Policy Before DataSource Resolution

**Files:**
- Create: `backend/execution-worker/src/test/java/com/company/opsagent/executionworker/PolicyEnforcedSqlDataSourceRegistryTest.java`
- Create: `backend/execution-worker/src/main/java/com/company/opsagent/executionworker/PolicyEnforcedSqlDataSourceRegistry.java`
- Modify: `backend/execution-worker/src/main/java/com/company/opsagent/executionworker/SqlDataSourceRegistry.java`
- Modify: `backend/execution-worker/src/main/java/com/company/opsagent/executionworker/JdbcSqlQueryExecutor.java`
- Modify: `backend/execution-worker/src/test/java/com/company/opsagent/executionworker/JdbcSqlQueryExecutorTest.java`

- [ ] **Step 1: Write the failing registry test**

```java
package com.company.opsagent.executionworker;

import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertFalse;

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

class PolicyEnforcedSqlDataSourceRegistryTest {

  @Test
  void delegatesOnlyAfterPolicyAllowsRequest() {
    JdbcDataSource dataSource = new JdbcDataSource();
    var registry = new PolicyEnforcedSqlDataSourceRegistry(policy(), request -> dataSource);

    DataSource resolved = registry.resolve(request("as400-dev-readonly", "development"));

    assertSame(dataSource, resolved);
  }

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
```

- [ ] **Step 2: Run the registry test to verify RED**

Run:

```powershell
.\mvnw.cmd -pl execution-worker -am -Dtest=PolicyEnforcedSqlDataSourceRegistryTest "-Dsurefire.failIfNoSpecifiedTests=false" test
```

Expected: compilation fails because `PolicyEnforcedSqlDataSourceRegistry` does not exist.

- [ ] **Step 3: Change `SqlDataSourceRegistry` and executor**

Change `SqlDataSourceRegistry` to:

```java
@FunctionalInterface
public interface SqlDataSourceRegistry {

  DataSource resolve(SqlQueryExecutionRequest request);
}
```

Change `JdbcSqlQueryExecutor.execute` to call:

```java
try (Connection connection = dataSourceRegistry.resolve(request).getConnection()) {
```

Update existing test lambdas from `connectionId -> dataSource` to `request -> dataSource`.

- [ ] **Step 4: Add the policy-enforced registry**

```java
package com.company.opsagent.executionworker;

import com.company.opsagent.contracts.sqlworkbench.SqlQueryExecutionRequest;
import javax.sql.DataSource;

/**
 * 在返回 JDBC DataSource 前强制执行 Worker SQL 出口策略。
 */
public class PolicyEnforcedSqlDataSourceRegistry implements SqlDataSourceRegistry {

  private final WorkerSqlEgressPolicy egressPolicy;
  private final SqlDataSourceRegistry delegate;

  public PolicyEnforcedSqlDataSourceRegistry(
      WorkerSqlEgressPolicy egressPolicy,
      SqlDataSourceRegistry delegate) {
    this.egressPolicy = egressPolicy;
    this.delegate = delegate;
  }

  @Override
  public DataSource resolve(SqlQueryExecutionRequest request) {
    egressPolicy.validate(request);
    return delegate.resolve(request);
  }
}
```

- [ ] **Step 5: Run registry and JDBC executor tests**

Run:

```powershell
.\mvnw.cmd -pl execution-worker -am -Dtest=PolicyEnforcedSqlDataSourceRegistryTest,JdbcSqlQueryExecutorTest "-Dsurefire.failIfNoSpecifiedTests=false" test
```

Expected: both tests pass.

## Task 4: Map Egress Denials to SQL Worker Rejections

**Files:**
- Modify: `backend/execution-worker/src/test/java/com/company/opsagent/executionworker/RestrictedSqlQueryExecutionWorkerTest.java`
- Modify: `backend/execution-worker/src/main/java/com/company/opsagent/executionworker/RestrictedSqlQueryExecutionWorker.java`

- [ ] **Step 1: Write the failing worker rejection test**

Add this test:

```java
@Test
void mapsEgressPolicyRejectionToRejectedResult() {
  var worker = new RestrictedSqlQueryExecutionWorker(
      new CalciteSqlReadOnlyGuard(),
      request -> {
        throw new WorkerSqlEgressException("SQL_EGRESS_NOT_ALLOWED", "SQL egress target is not allowed");
      },
      CLOCK);

  var result = worker.execute(request("select * from ORDERS.ORDERS", "development", 30));

  assertEquals("REJECTED", result.status());
  assertEquals("SQL_EGRESS_NOT_ALLOWED", result.errorCode());
}
```

- [ ] **Step 2: Run the worker test to verify RED**

Run:

```powershell
.\mvnw.cmd -pl execution-worker -am -Dtest=RestrictedSqlQueryExecutionWorkerTest "-Dsurefire.failIfNoSpecifiedTests=false" test
```

Expected: the new test fails because egress exceptions are currently mapped to `FAILED / SQL_EXECUTION_FAILED`.

- [ ] **Step 3: Catch `WorkerSqlEgressException` before generic runtime exceptions**

Add a catch block before `catch (RuntimeException exception)`:

```java
} catch (WorkerSqlEgressException exception) {
  return rejected(request, exception.errorCode(), exception.safeMessage());
}
```

- [ ] **Step 4: Run the worker test to verify GREEN**

Run the same Maven command. Expected: all `RestrictedSqlQueryExecutionWorkerTest` tests pass.

## Task 5: Add Local Configuration Binding

**Files:**
- Create: `backend/execution-worker/src/test/java/com/company/opsagent/executionworker/WorkerSqlEgressPropertiesTest.java`
- Create: `backend/execution-worker/src/main/java/com/company/opsagent/executionworker/WorkerSqlEgressProperties.java`
- Modify: `backend/execution-worker/src/main/java/com/company/opsagent/executionworker/ExecutionWorkerConfiguration.java`
- Modify: `backend/execution-worker/src/main/resources/application.yaml`

- [ ] **Step 1: Write the failing properties test**

```java
package com.company.opsagent.executionworker;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;

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

class WorkerSqlEgressPropertiesTest {

  @Test
  void convertsLocalPropertiesToPolicyInputs() {
    WorkerSqlEgressProperties properties = new WorkerSqlEgressProperties();
    properties.setAllowedTargets(List.of(target("as400-dev.internal", 446)));
    properties.setConnections(List.of(connection("as400-dev-readonly", "development", "as400-dev.internal", 446)));

    WorkerSqlEgressPolicy policy = properties.toPolicy();

    assertEquals(
        "as400-dev-readonly",
        policy.validate(request("as400-dev-readonly", "development")).connectionId());
  }

  @Test
  void defaultsToEmptyLists() {
    WorkerSqlEgressProperties properties = new WorkerSqlEgressProperties();

    assertFalse(properties.getAllowedTargets().iterator().hasNext());
    assertFalse(properties.getConnections().iterator().hasNext());
  }

  private WorkerSqlEgressProperties.Target target(String host, int port) {
    WorkerSqlEgressProperties.Target target = new WorkerSqlEgressProperties.Target();
    target.setHost(host);
    target.setPort(port);
    return target;
  }

  private WorkerSqlEgressProperties.Connection connection(String id, String environment, String host, int port) {
    WorkerSqlEgressProperties.Connection connection = new WorkerSqlEgressProperties.Connection();
    connection.setConnectionId(id);
    connection.setTargetEnvironment(environment);
    connection.setHost(host);
    connection.setPort(port);
    connection.setCredentialAlias(id);
    connection.setEnabled(true);
    return connection;
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
```

- [ ] **Step 2: Run properties test to verify RED**

Run:

```powershell
.\mvnw.cmd -pl execution-worker -am -Dtest=WorkerSqlEgressPropertiesTest "-Dsurefire.failIfNoSpecifiedTests=false" test
```

Expected: compilation fails because `WorkerSqlEgressProperties` does not exist.

- [ ] **Step 3: Add properties and configuration**

Create `WorkerSqlEgressProperties` with `@ConfigurationProperties(prefix = "ops-agent.worker.sql-egress")`, nested `Target` and `Connection` classes, list getters and setters, and `toPolicy()`.

Update `ExecutionWorkerConfiguration`:

```java
@EnableConfigurationProperties({WorkerTransportAuthProperties.class, WorkerSqlEgressProperties.class})
```

Update `application.yaml`:

```yaml
ops-agent:
  worker:
    sql-egress:
      allowed-targets: []
      connections: []
```

- [ ] **Step 4: Run properties test to verify GREEN**

Run the same Maven command. Expected: properties tests pass.

## Task 6: Documentation and Planning Updates

**Files:**
- Modify: `backend/execution-worker/README.md`
- Modify: `docs/runbooks/m07-worker-transport-auth.md`
- Modify: `docs/standards/p1-threat-model.md`
- Modify: `docs/planning/project-plan.md`
- Modify: `docs/planning/p1-read-only-vertical-slice-evidence.md`

- [ ] **Step 1: Update docs**

Add Chinese documentation explaining:

- Worker SQL egress allowlist is enforced before JDBC connection creation.
- Empty allowlist is the safe default.
- P1 still rejects production SQL connections.
- This is application-level egress control and does not replace firewall, private network, mTLS, short-lived credentials, or Windows isolation.

- [ ] **Step 2: Run repository checks**

Run:

```powershell
git diff --check
powershell -NoProfile -ExecutionPolicy Bypass -File .\tools\ci\check-repository.ps1
powershell -NoProfile -ExecutionPolicy Bypass -File .\tools\ci\check-contracts.ps1
powershell -NoProfile -ExecutionPolicy Bypass -File .\tools\ci\scan-secrets.ps1
```

Expected: all commands exit 0.

## Task 7: Full Verification

**Files:**
- No new files.

- [ ] **Step 1: Run focused execution-worker tests**

Run:

```powershell
.\mvnw.cmd -pl execution-worker -am "-Dtest=WorkerSqlConnectionDescriptorTest,WorkerSqlEgressPolicyTest,PolicyEnforcedSqlDataSourceRegistryTest,WorkerSqlEgressPropertiesTest,RestrictedSqlQueryExecutionWorkerTest,JdbcSqlQueryExecutorTest" "-Dsurefire.failIfNoSpecifiedTests=false" test
```

Expected: all focused tests pass.

- [ ] **Step 2: Run full backend verification**

Run:

```powershell
.\mvnw.cmd -f .\pom.xml -B -ntp verify
```

from `backend`.

Expected: Maven reactor `BUILD SUCCESS`.

- [ ] **Step 3: Review status**

Run:

```powershell
git status --short
git diff --stat
```

Expected: only intended M07 egress code, tests, docs, and plan files are modified.

## Self-Review

- Spec coverage: descriptor validation, policy validation, registry enforcement, worker rejection mapping, local configuration, docs, and verification are covered.
- Placeholder scan: no unresolved markers or vague edge-case steps remain.
- Type consistency: policy and registry use `SqlQueryExecutionRequest`; `JdbcSqlQueryExecutor` and test lambdas are updated to the same signature.
