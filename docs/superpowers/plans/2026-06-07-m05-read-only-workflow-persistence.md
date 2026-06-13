# M05 只读工作流持久化实施计划

> **供 Agent 执行使用：** 必须使用子技能 `superpowers:subagent-driven-development`（推荐）或 `superpowers:executing-plans` 按任务逐项实施。步骤使用复选框语法 `- [ ]` 跟踪进度。

**目标：** 为 `P1` 只读工作流路径增加关系型持久化、幂等、失败恢复和一次受控重放能力，同时保持现有 API 形状不变，不扩展到写操作工作流。

**架构：** 将所有工作流状态处理保持在 `backend/control-plane/modules/workflow` 内部，使用响应式 `H2` 文件数据库作为 `P1` 执行事实源。工作流服务在派发前先持久化状态，记录每次执行尝试与语义事件，并仅在控制面规则下重放可恢复失败。

**技术栈：** Java 21、Spring Boot 3.4、WebFlux、Spring R2DBC、`r2dbc-h2`、Jackson、JUnit 5、Reactor Test

---

## 文件地图

**新增**

- `docs/adr/0004-p1-read-only-workflow-persistence.md`
- `backend/control-plane/modules/workflow/src/main/java/com/company/opsagent/controlplane/modules/workflow/StoredWorkflowStatus.java`
- `backend/control-plane/modules/workflow/src/main/java/com/company/opsagent/controlplane/modules/workflow/StoredWorkflowAttemptKind.java`
- `backend/control-plane/modules/workflow/src/main/java/com/company/opsagent/controlplane/modules/workflow/StoredReadOnlyWorkflow.java`
- `backend/control-plane/modules/workflow/src/main/java/com/company/opsagent/controlplane/modules/workflow/StoredWorkflowAttempt.java`
- `backend/control-plane/modules/workflow/src/main/java/com/company/opsagent/controlplane/modules/workflow/StoredWorkflowEvent.java`
- `backend/control-plane/modules/workflow/src/main/java/com/company/opsagent/controlplane/modules/workflow/PersistedReadOnlyWorkflowView.java`
- `backend/control-plane/modules/workflow/src/main/java/com/company/opsagent/controlplane/modules/workflow/ReadOnlyWorkflowStore.java`
- `backend/control-plane/modules/workflow/src/main/java/com/company/opsagent/controlplane/modules/workflow/RetryableFailureClassifier.java`
- `backend/control-plane/modules/workflow/src/main/java/com/company/opsagent/controlplane/modules/workflow/ReadOnlyWorkflowRecoveryService.java`
- `backend/control-plane/modules/workflow/src/main/java/com/company/opsagent/controlplane/modules/workflow/R2dbcReadOnlyWorkflowStore.java`
- `backend/control-plane/modules/workflow/src/main/resources/sql/workflow-schema.sql`
- `backend/control-plane/modules/workflow/src/test/java/com/company/opsagent/controlplane/modules/workflow/R2dbcReadOnlyWorkflowStoreTest.java`
- `backend/control-plane/modules/workflow/src/test/java/com/company/opsagent/controlplane/modules/workflow/ReadOnlyWorkflowRecoveryServiceTest.java`
- `backend/control-plane/modules/workflow/src/test/java/com/company/opsagent/controlplane/modules/workflow/InMemoryReadOnlyWorkflowStoreFixture.java`
- `backend/control-plane/bootstrap/src/main/java/com/company/opsagent/controlplane/bootstrap/config/WorkflowPersistenceProperties.java`

**修改**

- `backend/control-plane/modules/workflow/pom.xml`
- `backend/control-plane/modules/workflow/src/main/java/com/company/opsagent/controlplane/modules/workflow/ReadOnlyDiagnosticWorkflowService.java`
- `backend/control-plane/modules/workflow/src/test/java/com/company/opsagent/controlplane/modules/workflow/ReadOnlyDiagnosticWorkflowServiceTest.java`
- `backend/control-plane/bootstrap/pom.xml`
- `backend/control-plane/bootstrap/src/main/java/com/company/opsagent/controlplane/bootstrap/config/WorkflowConfiguration.java`
- `backend/control-plane/bootstrap/src/main/resources/application.yaml`
- `docs/planning/project-plan.md`
- `docs/planning/p1-read-only-vertical-slice-evidence.md`
- `docs/runbooks/local-read-only-vertical-slice.md`

---

### 任务 1：ADR 与响应式持久化基线

**文件：**
- 新增：`docs/adr/0004-p1-read-only-workflow-persistence.md`
- 修改：`backend/control-plane/modules/workflow/pom.xml`
- 修改：`backend/control-plane/bootstrap/pom.xml`

- [ ] **步骤 1：先写 ADR 与依赖基线**

```markdown
# ADR 0004：P1 只读工作流持久化与恢复

- 状态：Accepted
- 日期：2026-06-07
- 负责人：Codex / project maintainers
- 相关模块：M05、M09
- 相关任务：P1 read-only workflow persistence

## 背景

P1 只读工作流已经具备路由、Worker 执行和语义事件输出，但状态、幂等和恢复仍停留在内存内，不满足执行事实源要求。

## 决策

P1 采用控制面内嵌的关系型工作流存储。开发态使用文件型 `H2`，访问方式采用 R2DBC，避免在 WebFlux 事件循环中执行阻塞 I/O。

## 考虑过的备选方案

- 完整工作流引擎：对 P1 过重。
- JDBC + boundedElastic：可行，但增加阻塞 I/O 管理复杂度。
- 单表幂等缓存：不能满足失败恢复与重放。

## 影响

- 正面：满足持久化、幂等、恢复。
- 负面：引入数据库初始化和数据迁移边界。
- 安全：重放控制仍由控制面决定。

## 验证方式

- H2 仓储集成测试
- 工作流状态迁移和恢复测试
- `backend` 全量 `verify`

## 发布与回滚

- 开发态使用 `var/workflow` 下的文件库。
- 回滚时禁用新持久化装配并恢复到前一提交。
```

- [ ] **步骤 2：加入 R2DBC 依赖，制造首个红灯**

修改 `backend/control-plane/modules/workflow/pom.xml`，让后续步骤可以基于响应式持久化 API 编译：

```xml
<dependency>
  <groupId>org.springframework</groupId>
  <artifactId>spring-r2dbc</artifactId>
</dependency>
<dependency>
  <groupId>com.fasterxml.jackson.core</groupId>
  <artifactId>jackson-databind</artifactId>
</dependency>
<dependency>
  <groupId>io.r2dbc</groupId>
  <artifactId>r2dbc-h2</artifactId>
  <scope>test</scope>
</dependency>
```

修改 `backend/control-plane/bootstrap/pom.xml`，提供运行期持久化依赖：

```xml
<dependency>
  <groupId>org.springframework.boot</groupId>
  <artifactId>spring-boot-starter-data-r2dbc</artifactId>
</dependency>
<dependency>
  <groupId>io.r2dbc</groupId>
  <artifactId>r2dbc-h2</artifactId>
</dependency>
```

- [ ] **步骤 3：运行模块测试，确认当前仍然是红灯**

在 `backend` 目录执行：

```powershell
.\mvnw.cmd -pl control-plane/modules/workflow -am -Dtest=R2dbcReadOnlyWorkflowStoreTest test
```

预期：FAIL，因为 `R2dbcReadOnlyWorkflowStoreTest` 和相关 store 类还不存在。

- [ ] **步骤 4：提交基线**

```bash
git add docs/adr/0004-p1-read-only-workflow-persistence.md backend/control-plane/modules/workflow/pom.xml backend/control-plane/bootstrap/pom.xml
git commit -m "Define P1 workflow persistence baseline"
```

---

### 任务 2：工作流存储与 H2 Schema

**文件：**
- 新增：`backend/control-plane/modules/workflow/src/main/java/com/company/opsagent/controlplane/modules/workflow/StoredWorkflowStatus.java`
- 新增：`backend/control-plane/modules/workflow/src/main/java/com/company/opsagent/controlplane/modules/workflow/StoredWorkflowAttemptKind.java`
- 新增：`backend/control-plane/modules/workflow/src/main/java/com/company/opsagent/controlplane/modules/workflow/StoredReadOnlyWorkflow.java`
- 新增：`backend/control-plane/modules/workflow/src/main/java/com/company/opsagent/controlplane/modules/workflow/StoredWorkflowAttempt.java`
- 新增：`backend/control-plane/modules/workflow/src/main/java/com/company/opsagent/controlplane/modules/workflow/StoredWorkflowEvent.java`
- 新增：`backend/control-plane/modules/workflow/src/main/java/com/company/opsagent/controlplane/modules/workflow/PersistedReadOnlyWorkflowView.java`
- 新增：`backend/control-plane/modules/workflow/src/main/java/com/company/opsagent/controlplane/modules/workflow/ReadOnlyWorkflowStore.java`
- 新增：`backend/control-plane/modules/workflow/src/main/java/com/company/opsagent/controlplane/modules/workflow/R2dbcReadOnlyWorkflowStore.java`
- 新增：`backend/control-plane/modules/workflow/src/main/resources/sql/workflow-schema.sql`
- 新增：`backend/control-plane/modules/workflow/src/test/java/com/company/opsagent/controlplane/modules/workflow/R2dbcReadOnlyWorkflowStoreTest.java`
- 新增：`backend/control-plane/modules/workflow/src/test/java/com/company/opsagent/controlplane/modules/workflow/InMemoryReadOnlyWorkflowStoreFixture.java`

- [ ] **步骤 1：先写失败的 H2 存储集成测试**

```java
@Test
void createsWorkflowAndFindsItByIdempotencyTuple() {
  var store = testStore();
  var created = store.createWorkflow(
      "workflow-1",
      "idempotency-1",
      "operator-1",
      "development",
      "node-health-read",
      "1.1.0",
      "sha256:abc",
      "decision-1",
      "policy-v1",
      "trace-1",
      "request-1",
      "command-1",
      OffsetDateTime.parse("2026-06-07T01:00:00Z"));

  StepVerifier.create(created.then(store.findByIdempotency(
          "idempotency-1",
          "operator-1",
          "development",
          "node-health-read",
          "sha256:abc")))
      .assertNext(view -> {
        assertEquals("workflow-1", view.workflow().workflowId());
        assertEquals(StoredWorkflowStatus.PENDING, view.workflow().status());
      })
      .verifyComplete();
}
```

- [ ] **步骤 2：运行测试并确认失败**

在 `backend` 目录执行：

```powershell
.\mvnw.cmd -pl control-plane/modules/workflow -am -Dtest=R2dbcReadOnlyWorkflowStoreTest test
```

预期：FAIL，因为 store、schema 和领域类型都还不存在。

- [ ] **步骤 3：实现工作流状态记录、store 接口和 schema**

创建状态枚举：

```java
public enum StoredWorkflowStatus {
  PENDING,
  ROUTED,
  DISPATCHING,
  RUNNING,
  SUCCEEDED,
  FAILED_RETRYABLE,
  FAILED_TERMINAL,
  REPLAYING
}
```

创建 store 接口：

```java
public interface ReadOnlyWorkflowStore {

  Mono<Void> createWorkflow(
      String workflowId,
      String idempotencyKey,
      String operatorId,
      String targetEnvironment,
      String skillId,
      String skillVersion,
      String parametersHash,
      String policyDecisionId,
      String policyVersion,
      String traceId,
      String requestId,
      String commandId,
      OffsetDateTime createdAt);

  Mono<PersistedReadOnlyWorkflowView> findByIdempotency(
      String idempotencyKey,
      String operatorId,
      String targetEnvironment,
      String skillId,
      String parametersHash);

  Mono<Void> appendEvent(String workflowId, long sequence, SemanticEvent event);
}
```

创建 schema：

```sql
create table if not exists workflow_instance (
  workflow_id varchar(64) primary key,
  idempotency_key varchar(128) not null,
  operator_id varchar(128) not null,
  target_environment varchar(64) not null,
  skill_id varchar(128) not null,
  skill_version varchar(64) not null,
  parameters_hash varchar(128) not null,
  status varchar(32) not null,
  policy_decision_id varchar(128) not null,
  policy_version varchar(64) not null,
  trace_id varchar(128) not null,
  request_id varchar(128) not null,
  command_id varchar(64) not null,
  current_attempt_no integer not null,
  max_replay_count integer not null,
  replay_count integer not null,
  result_status varchar(32),
  result_schema_id varchar(256),
  result_payload_json clob,
  error_code varchar(128),
  error_message clob,
  created_at timestamp with time zone not null,
  updated_at timestamp with time zone not null,
  completed_at timestamp with time zone
);

create table if not exists workflow_idempotency (
  idempotency_key varchar(128) not null,
  operator_id varchar(128) not null,
  target_environment varchar(64) not null,
  skill_id varchar(128) not null,
  parameters_hash varchar(128) not null,
  workflow_id varchar(64) not null,
  primary key (idempotency_key, operator_id, target_environment, skill_id, parameters_hash)
);

create table if not exists workflow_attempt (
  workflow_id varchar(64) not null,
  attempt_no integer not null,
  execution_request_id varchar(64) not null,
  attempt_kind varchar(16) not null,
  status varchar(32) not null,
  started_at timestamp with time zone not null,
  completed_at timestamp with time zone,
  expires_at timestamp with time zone,
  worker_error_code varchar(128),
  worker_error_message clob,
  retryable boolean not null default false,
  primary key (workflow_id, attempt_no)
);

create table if not exists workflow_event (
  workflow_id varchar(64) not null,
  sequence bigint not null,
  event_id varchar(64) not null,
  event_type varchar(64) not null,
  event_payload_json clob not null,
  created_at timestamp with time zone not null,
  primary key (workflow_id, sequence)
);
```

- [ ] **步骤 4：运行存储集成测试并确认通过**

在 `backend` 目录执行：

```powershell
.\mvnw.cmd -pl control-plane/modules/workflow -am -Dtest=R2dbcReadOnlyWorkflowStoreTest test
```

预期：PASS，创建/查询测试变绿。

- [ ] **步骤 5：提交存储层**

```bash
git add backend/control-plane/modules/workflow/pom.xml backend/control-plane/modules/workflow/src/main/java backend/control-plane/modules/workflow/src/main/resources/sql/workflow-schema.sql backend/control-plane/modules/workflow/src/test/java/com/company/opsagent/controlplane/modules/workflow/R2dbcReadOnlyWorkflowStoreTest.java
git commit -m "Add read-only workflow H2 store"
```

---

### 任务 3：持久化执行路径与幂等复用

**文件：**
- 修改：`backend/control-plane/modules/workflow/src/main/java/com/company/opsagent/controlplane/modules/workflow/ReadOnlyDiagnosticWorkflowService.java`
- 修改：`backend/control-plane/modules/workflow/src/test/java/com/company/opsagent/controlplane/modules/workflow/ReadOnlyDiagnosticWorkflowServiceTest.java`
- 新增：`backend/control-plane/modules/workflow/src/main/java/com/company/opsagent/controlplane/modules/workflow/RetryableFailureClassifier.java`
- 新增：`backend/control-plane/modules/workflow/src/test/java/com/company/opsagent/controlplane/modules/workflow/InMemoryReadOnlyWorkflowStoreFixture.java`

- [ ] **步骤 1：先写失败的服务测试，覆盖幂等复用与成功持久化**

新增测试：

```java
@Test
void returnsPersistedWorkflowWhenIdempotencyTupleAlreadySucceeded() {
  var store = new InMemoryReadOnlyWorkflowStoreFixture();
  store.seedSucceededWorkflow("workflow-1", "idempotency-1");
  var service = new ReadOnlyDiagnosticWorkflowService(routingService(), workerGatewayShouldNotRun(), clock, store, classifier());

  StepVerifier.create(service.execute(request("idempotency-1")))
      .assertNext(result -> assertEquals("workflow-1", result.workflowId()))
      .verifyComplete();
}

@Test
void persistsCreatedWorkflowAndCompletionEvents() {
  var store = new InMemoryReadOnlyWorkflowStoreFixture();
  var service = new ReadOnlyDiagnosticWorkflowService(routingService(), successfulGateway(), clock, store, classifier());

  StepVerifier.create(service.execute(request("idempotency-2")))
      .assertNext(result -> {
        assertEquals(StoredWorkflowStatus.SUCCEEDED, store.workflow("idempotency-2").status());
        assertEquals(4, store.events("idempotency-2").size());
      })
      .verifyComplete();
}
```

- [ ] **步骤 2：运行服务测试并确认失败**

在 `backend` 目录执行：

```powershell
.\mvnw.cmd -pl control-plane/modules/workflow -am -Dtest=ReadOnlyDiagnosticWorkflowServiceTest test
```

预期：FAIL，因为服务当前没有 store 依赖，也没有持久化路径。

- [ ] **步骤 3：重构工作流服务，创建、更新并复用持久化状态**

更新构造函数：

```java
public ReadOnlyDiagnosticWorkflowService(
    SkillRoutingService skillRoutingService,
    WorkerGateway workerGateway,
    Clock clock,
    ReadOnlyWorkflowStore workflowStore,
    RetryableFailureClassifier retryableFailureClassifier) {
  this.skillRoutingService = skillRoutingService;
  this.workerGateway = workerGateway;
  this.clock = clock;
  this.workflowStore = workflowStore;
  this.retryableFailureClassifier = retryableFailureClassifier;
}
```

增加“幂等优先”的执行流：

```java
public Mono<ReadOnlyWorkflowResult> execute(ReadOnlyWorkflowRequest request) {
  String parametersHash = parameterHash(request.parameters());
  return workflowStore.findByIdempotency(
          request.idempotencyKey(),
          request.operator().operatorId(),
          request.targetEnvironment(),
          request.skillId(),
          parametersHash)
      .flatMap(existing -> Mono.just(existing.toWorkflowResult()))
      .switchIfEmpty(Mono.defer(() -> createAndExecuteWorkflow(request, parametersHash)));
}
```

保证在派发前先落盘：

```java
private Mono<ReadOnlyWorkflowResult> createAndExecuteWorkflow(
    ReadOnlyWorkflowRequest request,
    String parametersHash) {
  String workflowId = UUID.randomUUID().toString();
  String commandId = UUID.randomUUID().toString();
  OffsetDateTime now = OffsetDateTime.now(clock);
  return routeSkill(request)
      .flatMap(selectedSkill -> workflowStore.createWorkflow(
              workflowId,
              request.idempotencyKey(),
              request.operator().operatorId(),
              request.targetEnvironment(),
              selectedSkill.skillId(),
              selectedSkill.version(),
              parametersHash,
              request.policyDecision().decisionId(),
              request.policyDecision().policyVersion(),
              request.trace().traceId(),
              request.trace().requestId(),
              commandId,
              now)
          .then(dispatchInitialAttempt(workflowId, commandId, request, selectedSkill, now)));
}
```

- [ ] **步骤 4：运行 workflow 模块测试并确认通过**

在 `backend` 目录执行：

```powershell
.\mvnw.cmd -pl control-plane/modules/workflow -am test
```

预期：PASS，现有工作流测试和新增幂等测试全部变绿。

- [ ] **步骤 5：提交持久化执行路径**

```bash
git add backend/control-plane/modules/workflow/src/main/java/com/company/opsagent/controlplane/modules/workflow/ReadOnlyDiagnosticWorkflowService.java backend/control-plane/modules/workflow/src/main/java/com/company/opsagent/controlplane/modules/workflow/RetryableFailureClassifier.java backend/control-plane/modules/workflow/src/test/java/com/company/opsagent/controlplane/modules/workflow/ReadOnlyDiagnosticWorkflowServiceTest.java
git commit -m "Persist read-only workflow execution state"
```

---

### 任务 4：恢复与一次受控重放

**文件：**
- 新增：`backend/control-plane/modules/workflow/src/main/java/com/company/opsagent/controlplane/modules/workflow/ReadOnlyWorkflowRecoveryService.java`
- 新增：`backend/control-plane/modules/workflow/src/test/java/com/company/opsagent/controlplane/modules/workflow/ReadOnlyWorkflowRecoveryServiceTest.java`
- 修改：`backend/control-plane/modules/workflow/src/main/java/com/company/opsagent/controlplane/modules/workflow/R2dbcReadOnlyWorkflowStore.java`
- 修改：`backend/control-plane/modules/workflow/src/main/resources/sql/workflow-schema.sql`

- [ ] **步骤 1：先写失败的恢复测试**

```java
@Test
void replaysRetryableWorkflowExactlyOnce() {
  var store = new InMemoryReadOnlyWorkflowStoreFixture();
  store.seedRetryableFailure("workflow-1", "idempotency-1", 0, 1);
  var gateway = replayGatewayReturningSuccess();
  var recoveryService = new ReadOnlyWorkflowRecoveryService(store, gateway, clock, classifier());

  StepVerifier.create(recoveryService.recoverStaleWorkflows())
      .expectNext(1)
      .verifyComplete();

  assertEquals(1, store.replayCount("workflow-1"));
  assertEquals(StoredWorkflowStatus.SUCCEEDED, store.workflowById("workflow-1").status());
}

@Test
void doesNotReplayTerminalFailure() {
  var store = new InMemoryReadOnlyWorkflowStoreFixture();
  store.seedTerminalFailure("workflow-2");
  var recoveryService = new ReadOnlyWorkflowRecoveryService(store, replayGatewayReturningSuccess(), clock, classifier());

  StepVerifier.create(recoveryService.recoverStaleWorkflows())
      .expectNext(0)
      .verifyComplete();
}
```

- [ ] **步骤 2：运行恢复测试并确认失败**

在 `backend` 目录执行：

```powershell
.\mvnw.cmd -pl control-plane/modules/workflow -am -Dtest=ReadOnlyWorkflowRecoveryServiceTest test
```

预期：FAIL，因为恢复服务和可重放候选扫描都还不存在。

- [ ] **步骤 3：实现恢复服务与重放次数限制**

增加恢复 API：

```java
public final class ReadOnlyWorkflowRecoveryService {

  public Mono<Integer> recoverStaleWorkflows() {
    return workflowStore.findReplayCandidates(OffsetDateTime.now(clock))
        .concatMap(this::replayCandidate)
        .reduce(0, Integer::sum);
  }

  private Mono<Integer> replayCandidate(PersistedReadOnlyWorkflowView candidate) {
    if (candidate.workflow().replayCount() >= candidate.workflow().maxReplayCount()) {
      return workflowStore.markTerminal(candidate.workflow().workflowId(), "REPLAY_EXHAUSTED", "replay budget exhausted")
          .thenReturn(0);
    }
    return dispatchReplay(candidate).thenReturn(1);
  }
}
```

实现 store 查询：

```java
public Flux<PersistedReadOnlyWorkflowView> findReplayCandidates(OffsetDateTime now) {
  return databaseClient.sql("""
      select wi.workflow_id
      from workflow_instance wi
      where wi.status in ('FAILED_RETRYABLE', 'DISPATCHING', 'RUNNING')
        and wi.replay_count < wi.max_replay_count
        and wi.updated_at <= :cutoff
      """)
      .bind("cutoff", now.minusSeconds(35))
      .map((row, metadata) -> row.get("workflow_id", String.class))
      .all()
      .concatMap(this::loadWorkflowView);
}
```

- [ ] **步骤 4：运行恢复测试和 workflow 模块测试集**

在 `backend` 目录执行：

```powershell
.\mvnw.cmd -pl control-plane/modules/workflow -am test
```

预期：PASS，重放测试变绿，服务测试无回归。

- [ ] **步骤 5：提交恢复支持**

```bash
git add backend/control-plane/modules/workflow/src/main/java/com/company/opsagent/controlplane/modules/workflow/ReadOnlyWorkflowRecoveryService.java backend/control-plane/modules/workflow/src/main/java/com/company/opsagent/controlplane/modules/workflow/R2dbcReadOnlyWorkflowStore.java backend/control-plane/modules/workflow/src/main/resources/sql/workflow-schema.sql backend/control-plane/modules/workflow/src/test/java/com/company/opsagent/controlplane/modules/workflow/ReadOnlyWorkflowRecoveryServiceTest.java
git commit -m "Add read-only workflow recovery and replay"
```

---

### 任务 5：Bootstrap 装配、运行手册与全量验证

**文件：**
- 新增：`backend/control-plane/bootstrap/src/main/java/com/company/opsagent/controlplane/bootstrap/config/WorkflowPersistenceProperties.java`
- 修改：`backend/control-plane/bootstrap/src/main/java/com/company/opsagent/controlplane/bootstrap/config/WorkflowConfiguration.java`
- 修改：`backend/control-plane/bootstrap/src/main/resources/application.yaml`
- 修改：`docs/planning/project-plan.md`
- 修改：`docs/planning/p1-read-only-vertical-slice-evidence.md`
- 修改：`docs/runbooks/local-read-only-vertical-slice.md`

- [ ] **步骤 1：先写失败的 bootstrap 集成测试**

新增一个 bootstrap 测试，要求启动时能够拿到 recovery service 和 store：

```java
@Test
void workflowConfigurationProvidesRecoveryServiceAndStore() {
  try (var context = new AnnotationConfigApplicationContext()) {
    context.register(WorkflowConfiguration.class);
    context.refresh();
    assertNotNull(context.getBean(ReadOnlyWorkflowStore.class));
    assertNotNull(context.getBean(ReadOnlyWorkflowRecoveryService.class));
  }
}
```

- [ ] **步骤 2：运行 bootstrap 测试并确认失败**

在 `backend` 目录执行：

```powershell
.\mvnw.cmd -pl control-plane/bootstrap -am -Dtest=ControlPlaneApplicationTest test
```

预期：FAIL，因为持久化属性和恢复装配还不存在。

- [ ] **步骤 3：接入 store、schema 初始化和启动恢复**

创建属性类：

```java
@ConfigurationProperties("ops-agent.workflow")
public class WorkflowPersistenceProperties {

  private String databasePath = "var/workflow/control-plane";
  private boolean startupRecoveryEnabled = true;

  public String getDatabasePath() {
    return databasePath;
  }

  public void setDatabasePath(String databasePath) {
    this.databasePath = databasePath;
  }

  public boolean isStartupRecoveryEnabled() {
    return startupRecoveryEnabled;
  }

  public void setStartupRecoveryEnabled(boolean startupRecoveryEnabled) {
    this.startupRecoveryEnabled = startupRecoveryEnabled;
  }
}
```

更新 `application.yaml`：

```yaml
spring:
  r2dbc:
    url: r2dbc:h2:file:///./var/workflow/control-plane;DB_CLOSE_ON_EXIT=FALSE

ops-agent:
  workflow:
    database-path: var/workflow/control-plane
    startup-recovery-enabled: true
```

更新 `WorkflowConfiguration.java`：

```java
@Bean
ReadOnlyWorkflowStore readOnlyWorkflowStore(DatabaseClient databaseClient, ObjectMapper objectMapper) {
  return new R2dbcReadOnlyWorkflowStore(databaseClient, objectMapper);
}

@Bean
ConnectionFactoryInitializer workflowSchemaInitializer(ConnectionFactory connectionFactory) {
  var initializer = new ConnectionFactoryInitializer();
  initializer.setConnectionFactory(connectionFactory);
  initializer.setDatabasePopulator(new ResourceDatabasePopulator(
      new ClassPathResource("sql/workflow-schema.sql")));
  return initializer;
}

@Bean
ReadOnlyWorkflowRecoveryService readOnlyWorkflowRecoveryService(
    ReadOnlyWorkflowStore workflowStore,
    WorkerGateway workerGateway) {
  return new ReadOnlyWorkflowRecoveryService(workflowStore, workerGateway, Clock.systemUTC(), new RetryableFailureClassifier());
}

@Bean
ApplicationRunner workflowRecoveryRunner(
    ReadOnlyWorkflowRecoveryService recoveryService,
    WorkflowPersistenceProperties properties) {
  return args -> {
    if (properties.isStartupRecoveryEnabled()) {
      recoveryService.recoverStaleWorkflows().block();
    }
  };
}
```

- [ ] **步骤 4：更新文档并运行全量验证**

更新文档：

- `project-plan.md`：提高 `M05` 进度，并记录 H2 持久化/重放已落地
- `p1-read-only-vertical-slice-evidence.md`：补充恢复/重放验证证据
- `local-read-only-vertical-slice.md`：补充工作流数据库文件位置和重放行为

在 `backend` 目录执行：

```powershell
.\mvnw.cmd -B -ntp verify
```

在仓库根目录执行：

```powershell
.\tools\ci\check-repository.ps1
.\tools\ci\check-contracts.ps1
.\tools\ci\scan-secrets.ps1
```

预期：所有命令通过；`backend verify` 可能仍会打印 Mockito 动态 agent 警告，但不能有失败。

- [ ] **步骤 5：提交装配与文档**

```bash
git add backend/control-plane/bootstrap/pom.xml backend/control-plane/bootstrap/src/main/java/com/company/opsagent/controlplane/bootstrap/config/WorkflowPersistenceProperties.java backend/control-plane/bootstrap/src/main/java/com/company/opsagent/controlplane/bootstrap/config/WorkflowConfiguration.java backend/control-plane/bootstrap/src/main/resources/application.yaml docs/planning/project-plan.md docs/planning/p1-read-only-vertical-slice-evidence.md docs/runbooks/local-read-only-vertical-slice.md
git commit -m "Wire persisted read-only workflow recovery"
```

## 自检

- 覆盖 spec：
  - 关系型持久化：任务 1-2
  - 幂等复用：任务 3
  - 可重放失败分类与重放：任务 4
  - bootstrap 与运维文档：任务 5
- 占位符扫描：
  - 不存在未解决的占位符或延后实现说明
- 类型一致性：
  - 工作流状态名在 store、service、recovery 和 schema 中保持一致
  - 重放限制统一使用 `max_replay_count` 与 `replay_count`
