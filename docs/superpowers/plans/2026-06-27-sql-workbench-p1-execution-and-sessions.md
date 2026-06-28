# SQL Workbench P1 Execution And Sessions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 SQL 工作台交付为 P1 可执行的开发/测试环境只读查询工作区，并补齐新建连接、多会话切换和展开工作区体验。

**Architecture:** 后端继续以控制面为唯一授权入口，控制面生成短期 SQL 执行信封并提交给受限 Worker；Worker 用本地 `credentialAlias`、出口 allowlist 和只读校验作为第二道边界。前端只调用控制面 API，通过 Zod 解析契约数据，页面状态不承载授权事实。

**Tech Stack:** Java 21、Spring Boot WebFlux、R2DBC/H2、Apache Calcite、JTOpen、React、JavaScript/JSX、JSDoc、Zod、TanStack Query、Vitest、Playwright。

---

## 1. 事实源

- 设计规格：`docs/superpowers/specs/2026-06-27-sql-workbench-p1-execution-and-sessions-design.md`
- ADR：`docs/adr/0006-p1-sql-workbench-boundary.md`、`docs/adr/0009-sql-workbench-controlled-development-crud.md`
- 产品设计：`docs/architecture/sql-workbench-product-design.md`
- 运行手册：`docs/runbooks/p1-sql-workbench.md`

## 2. 并行边界

后端 agent 独占写入：

- `backend/contracts/sqlworkbench/`
- `backend/contracts/src/main/java/com/company/opsagent/contracts/sqlworkbench/`
- `backend/control-plane/modules/sqlworkbench/`
- `backend/control-plane/bootstrap/src/main/java/com/company/opsagent/controlplane/bootstrap/api/SqlWorkbenchController.java`
- `backend/execution-worker-sqlworkbench/`
- 必要的后端测试、迁移脚本和运行手册补充

前端 agent 独占写入：

- `frontend/operator-console/src/api/sql-api.js`
- `frontend/operator-console/src/schemas/sql-schemas.js`
- `frontend/operator-console/src/features/sql-workbench/`
- 必要的前端 README、组件测试和 Playwright 用例补充

两个 agent 都不得修改对方独占文件；如发现契约字段需要调整，先在最终汇报中说明，不直接改对方文件。

## 3. 后端 Agent 工作包

### Task B1：连接创建契约与目录持久化

**Files:**

- Create: `backend/contracts/sqlworkbench/sql-connection-create-request-v1.schema.json`
- Create: `backend/contracts/sqlworkbench/sql-connection-probe-result-v1.schema.json`
- Create: `backend/contracts/src/main/java/com/company/opsagent/contracts/sqlworkbench/SqlConnectionCreateRequest.java`
- Create: `backend/contracts/src/main/java/com/company/opsagent/contracts/sqlworkbench/SqlConnectionProbeResult.java`
- Modify: `backend/contracts/src/main/java/com/company/opsagent/contracts/sqlworkbench/SqlConnectionSummary.java`
- Modify: `backend/control-plane/modules/sqlworkbench/src/main/java/com/company/opsagent/controlplane/modules/sqlworkbench/SqlConnectionCatalog.java`
- Replace or extend: `backend/control-plane/modules/sqlworkbench/src/main/java/com/company/opsagent/controlplane/modules/sqlworkbench/InMemorySqlConnectionCatalog.java`
- Test: `backend/control-plane/modules/sqlworkbench/src/test/java/com/company/opsagent/controlplane/modules/sqlworkbench/DefaultSqlWorkbenchServiceTest.java`

- [ ] Write failing tests for rejecting `production`, blank `credentialAlias`, unknown fields that look like secrets, and empty Schema allowlist.
- [ ] Add strong contract records for create request and probe result.
- [ ] Add catalog methods for create, find, list, and status update.
- [ ] Store only metadata and `credentialAlias`; never store raw password or JDBC URL credentials.
- [ ] Run targeted tests:

```powershell
backend\mvnw.cmd -f backend\pom.xml -pl contracts,control-plane/modules/sqlworkbench -am test
```

### Task B2：控制面执行 API 与工作流信封

**Files:**

- Modify: `backend/control-plane/modules/sqlworkbench/src/main/java/com/company/opsagent/controlplane/modules/sqlworkbench/SqlWorkbenchService.java`
- Modify: `backend/control-plane/modules/sqlworkbench/src/main/java/com/company/opsagent/controlplane/modules/sqlworkbench/DefaultSqlWorkbenchService.java`
- Modify: `backend/control-plane/bootstrap/src/main/java/com/company/opsagent/controlplane/bootstrap/api/SqlWorkbenchController.java`
- Test: `backend/control-plane/modules/sqlworkbench/src/test/java/com/company/opsagent/controlplane/modules/sqlworkbench/DefaultSqlWorkbenchServiceTest.java`

- [ ] Write failing tests for `POST /internal/sql-workbench/queries/run` accepting only `RUN_READ_ONLY`.
- [ ] Reuse validation before execution and bind SQL hash, validation hash, operator, policy decision, trace and idempotency key.
- [ ] Return stable `SqlQueryExecutionResult` or an execution status DTO to the frontend.
- [ ] Add `GET /internal/sql-workbench/results/{resultId}` for paged result reads.
- [ ] Ensure controller methods remain non-blocking at the WebFlux boundary.
- [ ] Run targeted tests:

```powershell
backend\mvnw.cmd -f backend\pom.xml -pl contracts,control-plane/modules/sqlworkbench,control-plane/bootstrap -am test
```

### Task B3：Worker probe、credentialAlias 和结果读取

**Files:**

- Modify: `backend/execution-worker-sqlworkbench/src/main/java/com/company/opsagent/executionworker/sqlworkbench/SqlWorkbenchWorkerConfiguration.java`
- Modify: `backend/execution-worker-sqlworkbench/src/main/java/com/company/opsagent/executionworker/sqlworkbench/PolicyEnforcedSqlDataSourceRegistry.java`
- Modify: `backend/execution-worker-sqlworkbench/src/main/java/com/company/opsagent/executionworker/sqlworkbench/JavaKeyStorePasswordProvider.java`
- Modify: `backend/execution-worker-sqlworkbench/src/main/java/com/company/opsagent/executionworker/sqlworkbench/SqlQueryExecutionController.java`
- Modify: `backend/execution-worker-sqlworkbench/src/main/java/com/company/opsagent/executionworker/sqlworkbench/RestrictedSqlQueryExecutionWorker.java`
- Test: `backend/execution-worker-sqlworkbench/src/test/java/com/company/opsagent/executionworker/sqlworkbench/*Test.java`

- [ ] Write failing tests for probe statuses `CREDENTIAL_ALIAS_NOT_FOUND`, `CREDENTIAL_LOCKED`, `EGRESS_NOT_ALLOWED`, `READY` and `PROBE_FAILED`.
- [ ] Add Worker-side probe endpoint or service method behind the existing Worker authentication boundary.
- [ ] Ensure JDBC execution stays on `boundedElastic` or equivalent isolated scheduler.
- [ ] Ensure Worker still rejects expired requests, production, DML, DDL and multi-statement SQL.
- [ ] Ensure result pages have `expiresAt` and expired pages cannot be read.
- [ ] Run targeted tests:

```powershell
backend\mvnw.cmd -f backend\pom.xml -pl contracts,execution-worker-sqlworkbench,execution-worker -am test
```

### Task B4：后端审计、文档和全量验证

**Files:**

- Modify: `docs/runbooks/p1-sql-workbench.md`
- Modify: `backend/contracts/sqlworkbench/README.md`
- Modify: `backend/control-plane/bootstrap/src/main/resources/application.yaml`
- Modify: `backend/control-plane/bootstrap/src/main/resources/application-oidc-example.yaml`
- Modify: `backend/control-plane/modules/audit/src/main/java/com/company/opsagent/controlplane/modules/audit/AuditEvent.java` only if the existing audit record cannot express SQL audit entries.
- Test: `backend/control-plane/modules/policy/src/test/java/com/company/opsagent/controlplane/modules/policy/RoleBasedPolicyDeciderTest.java`
- Test: `backend/control-plane/modules/audit/src/test/java/com/company/opsagent/controlplane/modules/audit/InMemoryAuditTrailTest.java` only if `AuditEvent` changes.

- [ ] Add audit events for connection create, probe, query validation, query run and result read.
- [ ] Add policy action names for SQL connection creation, probe and read-only execution using the existing policy pattern.
- [ ] Update the runbook from “目标” to “启用步骤” once implementation is complete.
- [ ] Run backend verification:

```powershell
backend\mvnw.cmd -f backend\pom.xml verify
```

## 4. 前端 Agent 工作包

### Task F1：API 与 Zod 契约

**Files:**

- Modify: `frontend/operator-console/src/schemas/sql-schemas.js`
- Modify: `frontend/operator-console/src/api/sql-api.js`
- Modify: `frontend/operator-console/src/features/sql-workbench/use-sql-workbench.js`
- Test: `frontend/operator-console/src/features/sql-workbench/SqlWorkbenchPage.test.jsx`

- [ ] Add Zod schemas for connection creation, probe result, query run result and result page.
- [ ] Add API functions for create connection, probe connection, run read-only query and read result page.
- [ ] Add TanStack Query hooks for the new APIs.
- [ ] Ensure no schema includes password, username-password pair or JDBC URL credential fields.
- [ ] Run targeted tests:

```powershell
Set-Location frontend\operator-console
npm run test -- src/features/sql-workbench/SqlWorkbenchPage.test.jsx
```

### Task F2：SQL 工作区布局收敛

**Files:**

- Modify: `frontend/operator-console/src/features/sql-workbench/SqlWorkbenchPage.jsx`
- Modify: `frontend/operator-console/src/features/sql-workbench/SqlWorkbenchPage.module.css`
- Test: `frontend/operator-console/src/features/sql-workbench/SqlWorkbenchPage.test.jsx`

- [ ] Remove the persistent left “连接与对象” column from the default grid.
- [ ] Keep object browsing as a collapsible drawer.
- [ ] Move service validation details to the right panel.
- [ ] Remove static execution-boundary cards from the right panel.
- [ ] Add `展开工作区` / `退出展开` control and persist current session state while toggling.
- [ ] Verify text does not overflow at `1280px`, `1440px` and `1920px`.

### Task F3：新建连接和多会话切换

**Files:**

- Modify: `frontend/operator-console/src/features/sql-workbench/SqlWorkbenchPage.jsx`
- Modify: `frontend/operator-console/src/features/sql-workbench/use-sql-workbench.js`
- Modify: `frontend/operator-console/src/features/sql-workbench/SqlWorkbenchPage.module.css`
- Test: `frontend/operator-console/src/features/sql-workbench/SqlWorkbenchPage.test.jsx`

- [ ] Add `新建连接` dialog or drawer.
- [ ] The form includes `displayName`、`targetEnvironment`、`host`、`port`、`defaultSchema`、`allowedSchemas`、`capabilities`、`credentialAlias`、`maxRowsDefault`、`timeoutSecondsDefault`.
- [ ] The form must not include password fields.
- [ ] Add `SQL 1` default session and `+ 新建会话`.
- [ ] Store SQL text, selected connection, Schema, validation report, execution status and result reference per session.
- [ ] Ensure switching sessions does not overwrite another session state.

### Task F4：执行 SELECT、结果区和前端验证

**Files:**

- Modify: `frontend/operator-console/src/features/sql-workbench/SqlWorkbenchPage.jsx`
- Modify: `frontend/operator-console/src/features/sql-workbench/SqlWorkbenchPage.module.css`
- Test: `frontend/operator-console/src/features/sql-workbench/SqlWorkbenchPage.test.jsx`
- Test: `frontend/operator-console/tests/e2e/operator-console.spec.js`

- [ ] Enable `执行 SELECT` only when the current statement is a single `SELECT` according to service validation.
- [ ] Keep DML on `DML 预检` only.
- [ ] Render execution status, result table, pagination cursor, empty result and Worker rejection.
- [ ] Ensure frontend never calls Worker directly.
- [ ] Run frontend verification:

```powershell
Set-Location frontend\operator-console
npm run build
npm run test:e2e
```

## 5. 集成顺序

1. 后端 agent 先稳定契约和控制面 API。
2. 前端 agent 可先使用测试 mock 按同名契约开发。
3. 合并时以 `backend/contracts/sqlworkbench` 和前端 Zod Schema 的字段一致性为门禁。
4. 最后由主 agent 运行后端目标测试、前端构建和浏览器截图验收。

## 6. 不做项

- 不开放生产连接。
- 不开放 DML 写执行。
- 不增加长期事务、手动 `Commit`、手动 `Rollback`。
- 不把 AI 建议作为授权或执行条件。
- 不让浏览器、控制面配置、日志或测试数据持有数据库密钥。
