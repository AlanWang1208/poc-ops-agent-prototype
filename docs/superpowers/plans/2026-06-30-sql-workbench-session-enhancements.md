# SQL Workbench Session Enhancements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 实现 SQL 工作台 `.sql` 导入导出、会话内 `SQL / 自然语言 / Compare` 三模式、自然语言 SELECT 草稿生成和同连接跨库名数据一致性对比。

**Architecture:** 前端按功能拆分组件，`SqlWorkbenchPage.jsx` 只保留页面装配、会话状态和服务调用编排；编辑器、自然语言、Compare、结果、AI 助手、连接管理分别独立成组件。后端在现有 M09 SQL 工作台服务中增量扩展只读 Compare 契约，复用现有 SQL 校验、Worker 执行和 AI SQL 助手，不新增部署服务或生产写能力。

**Tech Stack:** Java 21、Spring Boot WebFlux、Calcite SQL AST、React/JSX/JSDoc、Zod、TanStack Query、CodeMirror 6、Vitest、MSW、Maven。

---

## File Structure

前端组件拆分：

- Create: `frontend/operator-console/src/features/sql-workbench/sql-workbench-utils.js`
  - 放会话创建、CSV 拆分、SQL request 构建、诊断文本、SQL 语句切分等纯函数。
- Create: `frontend/operator-console/src/features/sql-workbench/SqlCodeEditor.jsx`
  - 放 CodeMirror 6 编辑器、SQL 注释高亮、每条 SQL 左侧运行按钮。
- Create: `frontend/operator-console/src/features/sql-workbench/SqlAssistantPanel.jsx`
  - 放 AI SQL 助手展示和建议应用按钮。
- Create: `frontend/operator-console/src/features/sql-workbench/SqlResultPanel.jsx`
  - 放查询结果分页、错误展示和展开模式下的内联 AI 助手。
- Create: `frontend/operator-console/src/features/sql-workbench/SqlNaturalLanguagePanel.jsx`
  - 放自然语言输入、引用当前 SQL 开关、草稿生成结果、应用并校验、AI 修正按钮。
- Create: `frontend/operator-console/src/features/sql-workbench/SqlComparePanel.jsx`
  - 放 Compare 表单、生成 SQL 折叠展示、diff 报告和 AI 摘要展示。
- Create: `frontend/operator-console/src/features/sql-workbench/SqlEditorPanel.jsx`
  - 放 `SQL / 自然语言 / Compare` 模式切换、工具栏、SQL 编辑器和功能面板装配。
- Modify: `frontend/operator-console/src/features/sql-workbench/SqlWorkbenchPage.jsx`
  - 删除已抽出的组件实现，仅保留页面状态、连接目录、mutation 编排、布局和连接管理入口。
- Modify: `frontend/operator-console/src/features/sql-workbench/SqlWorkbenchPage.module.css`
  - 增加模式切换、自然语言表单、Compare 表单和 diff 报告样式。
- Modify: `frontend/operator-console/src/features/sql-workbench/use-sql-workbench.js`
  - 增加 Compare mutation。
- Modify: `frontend/operator-console/src/api/sql-api.js`
  - 增加 Compare API client。
- Modify: `frontend/operator-console/src/schemas/sql-schemas.js`
  - 增加 `GENERATE_SELECT`、`COMPARE_SUMMARY`、Compare request/report Zod schema。
- Modify: `frontend/operator-console/src/features/sql-workbench/SqlWorkbenchPage.test.jsx`
  - 增加导入导出、模式切换、自然语言草稿、Compare 报告测试。

后端契约与服务：

- Modify: `backend/contracts/src/main/java/com/company/opsagent/contracts/sqlworkbench/SqlAssistantAction.java`
  - 增加 `GENERATE_SELECT` 和 `COMPARE_SUMMARY`。
- Create: `backend/contracts/src/main/java/com/company/opsagent/contracts/sqlworkbench/SqlCompareRequest.java`
- Create: `backend/contracts/src/main/java/com/company/opsagent/contracts/sqlworkbench/SqlCompareReport.java`
- Create: `backend/contracts/src/main/java/com/company/opsagent/contracts/sqlworkbench/SqlCompareStatus.java`
- Create: `backend/contracts/src/main/java/com/company/opsagent/contracts/sqlworkbench/SqlCompareRowDifference.java`
- Create: `backend/contracts/src/main/java/com/company/opsagent/contracts/sqlworkbench/SqlCompareFieldDifference.java`
- Modify: `backend/control-plane/modules/sqlworkbench/src/main/java/com/company/opsagent/controlplane/modules/sqlworkbench/SqlWorkbenchService.java`
  - 增加 `compareReadOnly(...)` 方法。
- Create: `backend/control-plane/modules/sqlworkbench/src/main/java/com/company/opsagent/controlplane/modules/sqlworkbench/SqlCompareService.java`
  - 放 Compare 输入校验、SQL 生成、结果 diff 计算。
- Modify: `backend/control-plane/modules/sqlworkbench/src/main/java/com/company/opsagent/controlplane/modules/sqlworkbench/DefaultSqlWorkbenchService.java`
  - 委托 `SqlCompareService`，复用 workerClient 和 assistantClient。
- Modify: `backend/control-plane/bootstrap/src/main/java/com/company/opsagent/controlplane/bootstrap/api/SqlWorkbenchController.java`
  - 增加 `/internal/sql-workbench/compare` POST 入口。
- Modify: `backend/control-plane/bootstrap/src/main/java/com/company/opsagent/controlplane/bootstrap/service/ModelProviderSqlAssistantClient.java`
  - 扩展 prompt，支持自然语言 SELECT 草稿和 Compare 摘要。

Tests:

- Modify: `backend/control-plane/modules/sqlworkbench/src/test/java/com/company/opsagent/controlplane/modules/sqlworkbench/DefaultSqlWorkbenchServiceTest.java`
- Create: `backend/control-plane/modules/sqlworkbench/src/test/java/com/company/opsagent/controlplane/modules/sqlworkbench/SqlCompareServiceTest.java`
- Modify: `backend/control-plane/bootstrap/src/test/java/com/company/opsagent/controlplane/bootstrap/api/SqlWorkbenchControllerTest.java`
- Modify: `backend/control-plane/bootstrap/src/test/java/com/company/opsagent/controlplane/bootstrap/service/ModelProviderSqlAssistantClientTest.java`
- Modify: `frontend/operator-console/src/features/sql-workbench/SqlWorkbenchPage.test.jsx`

---

### Task 1: Component Boundary Tests

**Files:**
- Modify: `frontend/operator-console/src/features/sql-workbench/SqlWorkbenchPage.test.jsx`

- [ ] **Step 1: Add failing tests for mode switching and import/export**

Add tests that assert:

```jsx
expect(screen.getByRole("tab", { name: "SQL" })).toBeInTheDocument();
expect(screen.getByRole("tab", { name: "自然语言" })).toBeInTheDocument();
expect(screen.getByRole("tab", { name: "Compare" })).toBeInTheDocument();
```

Add a test that uploads a `.sql` file through a hidden file input labeled `导入 .sql` and confirms existing editor content is overwritten only after `window.confirm` returns `true`.

- [ ] **Step 2: Run frontend test and verify it fails**

Run:

```powershell
cd frontend/operator-console
npm test -- SqlWorkbenchPage.test.jsx
```

Expected: FAIL because mode tabs and import/export controls do not exist.

---

### Task 2: Extract Shared SQL Workbench Utilities

**Files:**
- Create: `frontend/operator-console/src/features/sql-workbench/sql-workbench-utils.js`
- Modify: `frontend/operator-console/src/features/sql-workbench/SqlWorkbenchPage.jsx`

- [ ] **Step 1: Move pure helpers**

Move these functions and constants from `SqlWorkbenchPage.jsx` into `sql-workbench-utils.js`:

```js
export const DEFAULT_LIMITS = { maxRows: 500, maxBytes: 5_000_000, timeoutSeconds: 30 };
export const EMPTY_SESSION_SQL = "";
export const LEGACY_READ_ONLY_VALIDATION_ERROR = "query must pass read-only validation before execution";
export function createSession(index, sql) { /* existing implementation */ }
export function buildLimits(connection) { /* existing implementation */ }
export function buildSqlQueryRequest(connection, schema, action, sql, idempotencyAction) { /* existing implementation */ }
export function isLikelyReadOnlySql(sql) { /* existing implementation */ }
export function findSqlEditorStatements(sqlText) { /* existing implementation */ }
export function splitDiagnosticMessage(message) { /* existing implementation */ }
export function buildAssistantDiagnosticContext(session) { /* existing implementation */ }
export function createSqlIdempotencyKey(action) { /* existing implementation */ }
export function splitCsv(value) { /* existing implementation */ }
```

- [ ] **Step 2: Import helpers from page**

Update `SqlWorkbenchPage.jsx` imports to consume the utility module. Keep behavior unchanged.

- [ ] **Step 3: Run frontend test**

Run:

```powershell
cd frontend/operator-console
npm test -- SqlWorkbenchPage.test.jsx
```

Expected: Existing tests still pass or only fail for the new Task 1 tests.

---

### Task 3: Extract Editor, Result, and Assistant Components

**Files:**
- Create: `frontend/operator-console/src/features/sql-workbench/SqlCodeEditor.jsx`
- Create: `frontend/operator-console/src/features/sql-workbench/SqlAssistantPanel.jsx`
- Create: `frontend/operator-console/src/features/sql-workbench/SqlResultPanel.jsx`
- Modify: `frontend/operator-console/src/features/sql-workbench/SqlWorkbenchPage.jsx`

- [ ] **Step 1: Move CodeMirror editor**

Move `SqlCodeEditor`, `SqlRunGutterMarker`, `SqlRunGutterSpacerMarker`, `createSqlRunGutterExtension`, `exposeSqlRunGutter`, `sqlEditorTheme`, and `sqlCommentHighlightStyle` to `SqlCodeEditor.jsx`.

- [ ] **Step 2: Move AI panel**

Move `AiSqlAssistantPanel` to `SqlAssistantPanel.jsx`.

- [ ] **Step 3: Move result panel**

Move `ResultPanel`, `ErrorSummary`, `ErrorMessageContent`, `readResultCell`, and `PanelHeading` dependencies needed by result rendering to `SqlResultPanel.jsx`, or export a small shared `SqlPanelHeading.jsx` if needed.

- [ ] **Step 4: Run frontend test**

Run:

```powershell
cd frontend/operator-console
npm test -- SqlWorkbenchPage.test.jsx
```

Expected: Current SQL editing, execution, pagination, and assistant tests pass except tests intentionally waiting for new mode UI.

---

### Task 4: Implement SQL Mode Shell and Local Import/Export

**Files:**
- Create: `frontend/operator-console/src/features/sql-workbench/SqlEditorPanel.jsx`
- Modify: `frontend/operator-console/src/features/sql-workbench/SqlWorkbenchPage.jsx`
- Modify: `frontend/operator-console/src/features/sql-workbench/SqlWorkbenchPage.module.css`

- [ ] **Step 1: Add session mode state**

Extend `SqlWorkbenchSession` with:

```js
mode: "sql",
naturalLanguage: createNaturalLanguageState(),
compare: createCompareState(),
```

Supported modes:

```js
/** @typedef {"sql" | "natural-language" | "compare"} SqlSessionMode */
```

- [ ] **Step 2: Add `SqlEditorPanel`**

`SqlEditorPanel` receives:

```js
{
  activeConnection,
  activeLimits,
  activeSchema,
  canExecuteSelect,
  canPreflightDml,
  canRunSqlStatement,
  canValidate,
  onApplySql,
  onExportSql,
  onImportSqlFile,
  onModeChange,
  onRunSelect,
  onRunStatement,
  onSubmitValidation,
  session,
}
```

It renders the mode tabs, toolbar, import/export buttons and SQL editor when `session.mode === "sql"`.

- [ ] **Step 3: Implement import/export**

Import:

```js
async function handleImportSqlFile(file) {
  if (!file.name.toLowerCase().endsWith(".sql")) {
    updateSession(activeSession.id, { errorMessage: "只能导入 .sql 文件" });
    return;
  }
  if (activeSession.sql.trim() && !window.confirm("导入会覆盖当前 SQL，是否继续？")) {
    return;
  }
  updateSql(await file.text());
}
```

Export:

```js
function handleExportSql() {
  const fileName = window.prompt("请输入导出文件名", `${activeSession.label}.sql`);
  if (!fileName?.trim()) return;
  const normalized = fileName.trim().toLowerCase().endsWith(".sql") ? fileName.trim() : `${fileName.trim()}.sql`;
  const blob = new Blob([activeSession.sql], { type: "application/sql;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = normalized;
  link.click();
  URL.revokeObjectURL(url);
}
```

- [ ] **Step 4: Run frontend tests**

Run:

```powershell
cd frontend/operator-console
npm test -- SqlWorkbenchPage.test.jsx
```

Expected: mode switching and import/export tests pass.

---

### Task 5: Backend Compare Contract and Diff Engine

**Files:**
- Create contract records under `backend/contracts/src/main/java/com/company/opsagent/contracts/sqlworkbench/`
- Create: `backend/control-plane/modules/sqlworkbench/src/main/java/com/company/opsagent/controlplane/modules/sqlworkbench/SqlCompareService.java`
- Create: `backend/control-plane/modules/sqlworkbench/src/test/java/com/company/opsagent/controlplane/modules/sqlworkbench/SqlCompareServiceTest.java`

- [ ] **Step 1: Write failing compare service tests**

Add tests for:

```java
assertThrows(IllegalArgumentException.class, () -> compareService.compare(requestWithSemicolon()));
assertThrows(IllegalArgumentException.class, () -> compareService.compare(requestWithEmptyKey()));
assertEquals(SqlCompareStatus.DIFFERENT, report.status());
assertEquals(1, report.missingInCompareCount());
assertEquals(1, report.missingInBaseCount());
assertEquals(1, report.differentRowCount());
```

- [ ] **Step 2: Add compare contracts**

Add immutable records for request, report, row difference and field difference. Constructors must enforce contract version `1.0`, non-production environment, non-empty target identifiers, non-empty key fields and bounded `maxRows`.

- [ ] **Step 3: Implement SQL generation**

Generate only:

```sql
select <fields> from <library>.<table> where <condition>
```

Reject where fragments containing `;`, `union`, `order by`, `group by`, `limit`, `insert`, `update`, `delete`, `drop`, `alter`, `create`.

- [ ] **Step 4: Implement deterministic diff**

Map result rows by business key. Count missing rows, extra rows and different rows. Limit sample differences to a small bounded list.

- [ ] **Step 5: Run module tests**

Run:

```powershell
.\mvnw -pl backend/control-plane/modules/sqlworkbench -Dtest=SqlCompareServiceTest test
```

Expected: PASS.

---

### Task 6: Wire Compare Through Service and Controller

**Files:**
- Modify: `backend/control-plane/modules/sqlworkbench/src/main/java/com/company/opsagent/controlplane/modules/sqlworkbench/SqlWorkbenchService.java`
- Modify: `backend/control-plane/modules/sqlworkbench/src/main/java/com/company/opsagent/controlplane/modules/sqlworkbench/DefaultSqlWorkbenchService.java`
- Modify: `backend/control-plane/bootstrap/src/main/java/com/company/opsagent/controlplane/bootstrap/api/SqlWorkbenchController.java`
- Modify: `backend/control-plane/bootstrap/src/test/java/com/company/opsagent/controlplane/bootstrap/api/SqlWorkbenchControllerTest.java`

- [ ] **Step 1: Add failing controller test**

Post a JSON payload to `controller.compare(...)` and assert it reaches typed `SqlCompareRequest`. Also assert unknown field `password` is rejected before service.

- [ ] **Step 2: Add service method**

Add:

```java
SqlCompareReport compareReadOnly(
    SqlCompareRequest request,
    OperatorContext operator,
    PolicyDecisionReference policyDecision,
    TraceContext trace);
```

- [ ] **Step 3: Add controller endpoint**

Add:

```java
@PostMapping("/compare")
public Mono<SqlCompareReport> compare(@RequestBody JsonNode request, ServerWebExchange exchange)
```

Use the same execution context pattern as `/queries/run`.

- [ ] **Step 4: Run backend tests**

Run:

```powershell
.\mvnw -pl backend/control-plane/bootstrap -Dtest=SqlWorkbenchControllerTest test
```

Expected: PASS.

---

### Task 7: Natural Language Panel Using Existing Assistant Boundary

**Files:**
- Modify: `backend/contracts/src/main/java/com/company/opsagent/contracts/sqlworkbench/SqlAssistantAction.java`
- Modify: `backend/control-plane/bootstrap/src/main/java/com/company/opsagent/controlplane/bootstrap/service/ModelProviderSqlAssistantClient.java`
- Create: `frontend/operator-console/src/features/sql-workbench/SqlNaturalLanguagePanel.jsx`
- Modify: `frontend/operator-console/src/schemas/sql-schemas.js`

- [ ] **Step 1: Add assistant actions**

Add:

```java
GENERATE_SELECT,
COMPARE_SUMMARY
```

and update Zod enum.

- [ ] **Step 2: Extend model prompt**

When action is `GENERATE_SELECT`, system prompt must require JSON suggestions whose first `suggestedSql` is a SELECT-only draft and must include assumptions in `safetyNotes`.

- [ ] **Step 3: Add natural language panel**

The panel contains library, table, fields, natural language textarea, current SQL context checkbox, generated draft, assumptions, “应用到编辑器并校验” and “让 AI 修正”.

- [ ] **Step 4: Run frontend tests**

Run:

```powershell
cd frontend/operator-console
npm test -- SqlWorkbenchPage.test.jsx
```

Expected: natural language tests pass.

---

### Task 8: Compare Frontend Integration

**Files:**
- Create: `frontend/operator-console/src/features/sql-workbench/SqlComparePanel.jsx`
- Modify: `frontend/operator-console/src/api/sql-api.js`
- Modify: `frontend/operator-console/src/features/sql-workbench/use-sql-workbench.js`
- Modify: `frontend/operator-console/src/schemas/sql-schemas.js`
- Modify: `frontend/operator-console/src/features/sql-workbench/SqlWorkbenchPage.test.jsx`

- [ ] **Step 1: Add schemas and API client**

Add `sqlCompareRequestSchema` and `sqlCompareReportSchema`, then:

```js
export function compareSqlTargets(input) {
  const request = sqlCompareRequestSchema.parse(input);
  return requestJson("/internal/sql-workbench/compare", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
    schema: sqlCompareReportSchema,
  });
}
```

- [ ] **Step 2: Add Compare panel**

Render form fields for base library, compare library, table, fields, key fields, ignored fields, where condition and maxRows. Submit calls `compareSqlTargets`.

- [ ] **Step 3: Render report**

Show status, generated SQL in `<details>`, summary counts, row-difference samples and AI summary if present.

- [ ] **Step 4: Run frontend tests**

Run:

```powershell
cd frontend/operator-console
npm test -- SqlWorkbenchPage.test.jsx
```

Expected: Compare tests pass.

---

### Task 9: Verification

**Files:**
- No new files unless tests reveal focused fixes.

- [ ] **Step 1: Run focused backend tests**

Run:

```powershell
.\mvnw -pl backend/control-plane/modules/sqlworkbench test
.\mvnw -pl backend/control-plane/bootstrap -Dtest=SqlWorkbenchControllerTest,ModelProviderSqlAssistantClientTest test
```

- [ ] **Step 2: Run focused frontend tests**

Run:

```powershell
cd frontend/operator-console
npm test -- SqlWorkbenchPage.test.jsx
npm run check
```

- [ ] **Step 3: Browser verification**

Start or reuse the dev server and verify `/sql`:

- SQL mode still edits and validates.
- `.sql` import prompts before overwrite.
- Natural language mode creates a draft and does not overwrite editor until applied.
- Compare mode displays diff report from mocked API or local backend.

- [ ] **Step 4: Commit implementation**

Stage only relevant implementation files. Do not stage `.superpowers/` visual board files or unrelated dirty files unless they are part of this feature.

```powershell
git status --short
git add <feature files>
git commit -m "Add SQL workbench session modes"
```

---

## Self-Review

- Spec coverage: `.sql` import/export covered in Task 4; component split covered in Tasks 2-4 and 7-8; natural language mode covered in Task 7; Compare backend and UI covered in Tasks 5-8; verification covered in Task 9.
- Placeholder scan: no `TBD` or open placeholder tasks remain.
- Type consistency: Frontend action names `GENERATE_SELECT` and `COMPARE_SUMMARY` match Java enum and Zod enum; Compare endpoint path is consistently `/internal/sql-workbench/compare`.
