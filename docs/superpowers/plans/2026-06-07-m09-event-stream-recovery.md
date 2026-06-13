# M09 Event Stream Recovery Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build current-workflow event stream auto-recovery for the P1 read-only operator console without expanding into login flow or write execution.

**Architecture:** Keep the existing startup SSE endpoint for first connection, add a read-only recovery SSE endpoint backed by persisted workflow events, and teach the React console to reconnect with `workflowId + afterSequence` while deduplicating strong-typed events. Reuse M05 persistence as the only recovery fact source and keep server-side auth, policy, and audit in place for both startup and recovery requests.

**Tech Stack:** Java 21, Spring Boot WebFlux, Reactor, R2DBC, React 19, TypeScript 5, Vite

---

## File Map

**Create**

- `docs/superpowers/specs/2026-06-07-m09-event-stream-recovery-design.md`
- `docs/superpowers/plans/2026-06-07-m09-event-stream-recovery.md`

**Modify**

- `backend/control-plane/modules/workflow/src/main/java/com/company/opsagent/controlplane/modules/workflow/ReadOnlyWorkflowStore.java`
- `backend/control-plane/modules/workflow/src/main/java/com/company/opsagent/controlplane/modules/workflow/R2dbcReadOnlyWorkflowStore.java`
- `backend/control-plane/modules/workflow/src/test/java/com/company/opsagent/controlplane/modules/workflow/R2dbcReadOnlyWorkflowStoreTest.java`
- `backend/control-plane/bootstrap/src/main/java/com/company/opsagent/controlplane/bootstrap/api/ReadOnlyDiagnosticController.java`
- `backend/control-plane/bootstrap/src/test/java/com/company/opsagent/controlplane/bootstrap/ControlPlaneApplicationTest.java`
- `frontend/operator-console/src/api.ts`
- `frontend/operator-console/src/App.tsx`
- `frontend/operator-console/src/types.ts`
- `frontend/operator-console/src/styles.css`
- `docs/runbooks/local-read-only-vertical-slice.md`
- `docs/planning/p1-read-only-vertical-slice-evidence.md`
- `docs/planning/project-plan.md`

---

### Task 1: Add persisted event recovery query in workflow store

**Files:**
- Modify: `backend/control-plane/modules/workflow/src/main/java/com/company/opsagent/controlplane/modules/workflow/ReadOnlyWorkflowStore.java`
- Modify: `backend/control-plane/modules/workflow/src/main/java/com/company/opsagent/controlplane/modules/workflow/R2dbcReadOnlyWorkflowStore.java`
- Modify: `backend/control-plane/modules/workflow/src/test/java/com/company/opsagent/controlplane/modules/workflow/R2dbcReadOnlyWorkflowStoreTest.java`

- [ ] **Step 1: Write the failing store test**

```java
@Test
void loadsOnlyEventsAfterGivenSequence() {
  var store = testStore();
  var createdAt = OffsetDateTime.parse("2026-06-07T08:00:00Z");
  var command = command("workflow-1", "command-1", "idem-1");
  var first = workflowStarted("workflow-1", 1, createdAt);
  var second = skillRouted("workflow-1", 2, createdAt.plusSeconds(1));
  var third = workerAccepted("workflow-1", 3, createdAt.plusSeconds(2));

  StepVerifier.create(store.createWorkflow(
          "workflow-1",
          "idem-1",
          "operator-1",
          "development",
          "node-health-read",
          "1.1.0",
          "params-1",
          "decision-1",
          "policy-v1",
          "trace-1",
          "request-1",
          "command-1",
          command,
          createdAt)
      .then(store.appendEvent("workflow-1", 1, first))
      .then(store.appendEvent("workflow-1", 2, second))
      .then(store.appendEvent("workflow-1", 3, third))
      .thenMany(store.loadEventsAfter("workflow-1", 1)))
      .assertNext(event -> assertEquals(2, event.sequence()))
      .assertNext(event -> assertEquals(3, event.sequence()))
      .verifyComplete();
}
```

- [ ] **Step 2: Run the test to verify it fails**

Run:

```powershell
Set-Location backend
.\mvnw.cmd -pl control-plane/modules/workflow -am -Dtest=R2dbcReadOnlyWorkflowStoreTest test
```

Expected: FAIL because `loadEventsAfter(...)` does not exist yet.

- [ ] **Step 3: Implement the minimal store API**

```java
public interface ReadOnlyWorkflowStore {

  // existing methods omitted

  Flux<SemanticEvent> loadEventsAfter(String workflowId, long afterSequence);
}
```

```java
@Override
public Flux<SemanticEvent> loadEventsAfter(String workflowId, long afterSequence) {
  return databaseClient.sql("""
          select workflow_id, sequence, event_id, event_type, event_payload_json, created_at
          from workflow_event
          where workflow_id = :workflowId
            and sequence > :afterSequence
          order by sequence asc
          """)
      .bind("workflowId", workflowId)
      .bind("afterSequence", afterSequence)
      .map((row, metadata) -> new StoredWorkflowEvent(
          row.get("workflow_id", String.class),
          valueOrZero(row.get("sequence", Long.class)),
          row.get("event_id", String.class),
          row.get("event_type", String.class),
          row.get("event_payload_json", String.class),
          row.get("created_at", OffsetDateTime.class)))
      .all()
      .map(this::deserializeEvent);
}
```

- [ ] **Step 4: Run the store test to verify it passes**

Run:

```powershell
Set-Location backend
.\mvnw.cmd -pl control-plane/modules/workflow -am -Dtest=R2dbcReadOnlyWorkflowStoreTest test
```

Expected: PASS with the new recovery query covered.

- [ ] **Step 5: Commit**

```bash
git add backend/control-plane/modules/workflow/src/main/java/com/company/opsagent/controlplane/modules/workflow/ReadOnlyWorkflowStore.java backend/control-plane/modules/workflow/src/main/java/com/company/opsagent/controlplane/modules/workflow/R2dbcReadOnlyWorkflowStore.java backend/control-plane/modules/workflow/src/test/java/com/company/opsagent/controlplane/modules/workflow/R2dbcReadOnlyWorkflowStoreTest.java
git commit -m "Add persisted workflow event recovery query"
```

### Task 2: Expose recovery SSE endpoint from control plane

**Files:**
- Modify: `backend/control-plane/bootstrap/src/main/java/com/company/opsagent/controlplane/bootstrap/api/ReadOnlyDiagnosticController.java`
- Modify: `backend/control-plane/bootstrap/src/test/java/com/company/opsagent/controlplane/bootstrap/ControlPlaneApplicationTest.java`

- [ ] **Step 1: Write the failing controller test**

```java
@Test
void streamsPersistedEventsAfterSequence() {
  webTestClient.get()
      .uri("/internal/diagnostics/read-only/workflows/{workflowId}/events?afterSequence=2", "workflow-1")
      .headers(headers -> headers.setBearerAuth(readerToken()))
      .exchange()
      .expectStatus().isOk()
      .expectHeader().contentTypeCompatibleWith(MediaType.TEXT_EVENT_STREAM)
      .expectBody(String.class)
      .value(body -> {
        assertThat(body).contains("event:WORKER_ACCEPTED");
        assertThat(body).doesNotContain("event:WORKFLOW_STARTED");
      });
}
```

- [ ] **Step 2: Run the controller test to verify it fails**

Run:

```powershell
Set-Location backend
.\mvnw.cmd -pl control-plane/bootstrap -am -Dtest=ControlPlaneApplicationTest test
```

Expected: FAIL because the recovery endpoint is missing.

- [ ] **Step 3: Implement the recovery endpoint**

```java
@GetMapping(value = "/read-only/workflows/{workflowId}/events", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
public Flux<ServerSentEvent<SemanticEvent>> resumeEvents(
    @PathVariable String workflowId,
    @RequestParam(name = "afterSequence", defaultValue = "0") long afterSequence) {
  return workflowStore.loadEventsAfter(workflowId, afterSequence)
      .map(event -> ServerSentEvent.<SemanticEvent>builder()
          .id(event.eventId())
          .event(event.type().name())
          .data(event)
          .build());
}
```

- [ ] **Step 4: Run the controller test to verify it passes**

Run:

```powershell
Set-Location backend
.\mvnw.cmd -pl control-plane/bootstrap -am -Dtest=ControlPlaneApplicationTest test
```

Expected: PASS and the SSE body contains only the requested tail events.

- [ ] **Step 5: Commit**

```bash
git add backend/control-plane/bootstrap/src/main/java/com/company/opsagent/controlplane/bootstrap/api/ReadOnlyDiagnosticController.java backend/control-plane/bootstrap/src/test/java/com/company/opsagent/controlplane/bootstrap/ControlPlaneApplicationTest.java
git commit -m "Expose read-only workflow event recovery stream"
```

### Task 3: Add front-end reconnection state and recovery fetch

**Files:**
- Modify: `frontend/operator-console/src/api.ts`
- Modify: `frontend/operator-console/src/App.tsx`
- Modify: `frontend/operator-console/src/types.ts`
- Modify: `frontend/operator-console/src/styles.css`

- [ ] **Step 1: Write the smallest failing behavior slice**

Implement a pure TypeScript helper first and call it from `App.tsx`:

```typescript
export function mergeRecoveredEvent(
  current: SemanticEvent[],
  incoming: SemanticEvent,
): SemanticEvent[] {
  return current.some((item) => item.eventId === incoming.eventId)
    ? current
    : [...current, incoming].sort((left, right) => left.sequence - right.sequence);
}
```

Add usage that expects:

```typescript
setEvents((current) => mergeRecoveredEvent(current, semanticEvent));
```

Expected initial build failure: helper is referenced before it exists.

- [ ] **Step 2: Run the front-end build to verify failure**

Run:

```powershell
Set-Location frontend/operator-console
npm run build
```

Expected: FAIL because recovery helpers and new types are not implemented yet.

- [ ] **Step 3: Implement minimal recovery API and UI state**

```typescript
export type EventStreamPhase =
  | "idle"
  | "connecting"
  | "streaming"
  | "reconnecting"
  | "completed"
  | "failed";
```

```typescript
export async function resumeDiagnosticEvents(
  workflowId: string,
  afterSequence: number,
  token: string,
  onEvent: (event: SemanticEvent) => void,
): Promise<void> {
  const headers = new Headers({ Accept: "text/event-stream" });
  if (token.trim()) {
    headers.set("Authorization", `Bearer ${token.trim()}`);
  }
  const response = await fetch(
    `/internal/diagnostics/read-only/workflows/${encodeURIComponent(workflowId)}/events?afterSequence=${afterSequence}`,
    { method: "GET", headers, credentials: "include" },
  );
  await readEventStream(response, onEvent);
}
```

```typescript
const [phase, setPhase] = useState<EventStreamPhase>("idle");
const [workflowId, setWorkflowId] = useState("");
const [lastSequence, setLastSequence] = useState(0);
```

```typescript
function handleSemanticEvent(semanticEvent: SemanticEvent) {
  setWorkflowId((current) => current || semanticEvent.workflowId);
  setLastSequence((current) => Math.max(current, semanticEvent.sequence));
  setEvents((current) => mergeRecoveredEvent(current, semanticEvent));
  setPhase(isTerminalEvent(semanticEvent) ? "completed" : "streaming");
}
```

- [ ] **Step 4: Run the front-end build to verify it passes**

Run:

```powershell
Set-Location frontend/operator-console
npm run build
```

Expected: PASS and the console bundles with the new recovery state.

- [ ] **Step 5: Commit**

```bash
git add frontend/operator-console/src/api.ts frontend/operator-console/src/App.tsx frontend/operator-console/src/types.ts frontend/operator-console/src/styles.css
git commit -m "Add operator console event stream recovery"
```

### Task 4: Update runbook and verify the full slice

**Files:**
- Modify: `docs/runbooks/local-read-only-vertical-slice.md`
- Modify: `docs/planning/p1-read-only-vertical-slice-evidence.md`
- Modify: `docs/planning/project-plan.md`

- [ ] **Step 1: Document recovery behavior and manual acceptance**

```markdown
- 断开浏览器网络或刷新代理后，操作台会进入“恢复中”状态；
- 控制面恢复接口按 `workflowId + afterSequence` 返回后续已落盘事件；
- 收到 `WORKFLOW_COMPLETED` 或 `WORKFLOW_FAILED` 后停止自动重连。
```

- [ ] **Step 2: Run backend verification**

Run:

```powershell
Set-Location backend
.\mvnw.cmd -pl control-plane/modules/workflow -am test
.\mvnw.cmd -pl control-plane/bootstrap -am -Dtest=ControlPlaneApplicationTest test
```

Expected: PASS with zero failing tests in the touched backend areas.

- [ ] **Step 3: Run front-end verification**

Run:

```powershell
Set-Location frontend/operator-console
npm run build
```

Expected: PASS.

- [ ] **Step 4: Perform browser acceptance**

Run local services, then verify:

```text
1. 启动 Worker、控制面、前端开发服务。
2. 发起只读诊断并确认时间线正常出现。
3. 在终态前人为断开前端连接。
4. 观察界面进入“恢复中”并继续显示未重复事件。
5. 工作流终态后界面转为“完成”或“失败”，不再继续重连。
```

- [ ] **Step 5: Commit**

```bash
git add docs/runbooks/local-read-only-vertical-slice.md docs/planning/p1-read-only-vertical-slice-evidence.md docs/planning/project-plan.md
git commit -m "Document M09 event stream recovery"
```
