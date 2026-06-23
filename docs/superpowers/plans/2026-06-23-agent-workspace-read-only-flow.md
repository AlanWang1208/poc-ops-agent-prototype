# Agent 工作区只读诊断全流程实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让 Agent 工作区的发送按钮触发现有 `node-health-read@1.1.0` 只读诊断事件流，并在页面中展示强类型事件和 Worker 返回的节点健康结果。

**Architecture:** 前端只新增事件流 API、Zod Schema、Agent 工作区本地状态机和渲染状态。执行仍走现有 `/internal/diagnostics/read-only/events`、M05 持久化工作流和 M07 独立 Worker，不新增后端接口、不启用 AgentRuntime。

**Tech Stack:** React 19、JavaScript/JSX、JSDoc、Zod、TanStack Query、MSW、Vitest、React Testing Library、CSS Modules。

---

## 文件结构

- 修改 `frontend/operator-console/src/schemas/agent-schemas.js`
  - 增加只读诊断请求 Schema。
  - 增加 `nodeHealthOutputSchema`，用于校验 `WORKFLOW_COMPLETED.payload.output`。
  - 导出 JSDoc 类型，供 API 和 Hook 使用。
- 修改 `frontend/operator-console/src/api/agent-api.js`
  - 保留现有 `searchSkillCandidates`。
  - 新增 `streamReadOnlyDiagnosticEvents(request, options)`，集中处理 `text/event-stream`、HTTP 错误和逐条事件 Schema 校验。
  - 页面组件不得直接调用 `fetch`。
- 创建 `frontend/operator-console/src/features/agent-workspace/use-read-only-diagnostic-workflow.js`
  - 封装固定 P1 请求：`node-health-read`、`development`、`node-a`。
  - 生成幂等键。
  - 管理 `idle/running/succeeded/failed/denied/contractError` 状态。
  - 按 `eventId` 去重、按 `sequence` 排序。
  - 校验并保存节点健康输出。
- 修改 `frontend/operator-console/src/features/agent-workspace/AgentWorkspacePage.jsx`
  - 根据候选 Skill 决定发送按钮是否启用。
  - 点击后调用 Hook。
  - 渲染动态 workflow 卡片、事件链、结果、拒绝和契约错误。
  - 保留现有视觉结构和不展示模型内部推理的约束。
- 修改 `frontend/operator-console/src/features/agent-workspace/AgentWorkspacePage.module.css`
  - 增加事件 chip、结果网格、错误提示和运行态样式。
  - 不改变整体页面布局和配色主题。
- 修改 `frontend/operator-console/src/features/agent-workspace/AgentWorkspacePage.test.jsx`
  - 把原先“发送按钮禁用”的成功候选测试改为“可发送”。
  - 增加成功事件流、`403` 拒绝、`WORKFLOW_FAILED`、契约错误和无候选禁用测试。
- 修改 `frontend/operator-console/src/api/client.test.js`
  - 增加事件流 API 路径、请求体和事件解析测试。
- 修改 `frontend/operator-console/src/schemas/schemas.test.js`
  - 增加节点健康输出 Schema 成功和失败测试。

---

## Task 1: 增加只读诊断请求和节点健康输出 Schema

**Files:**
- Modify: `frontend/operator-console/src/schemas/agent-schemas.js`
- Test: `frontend/operator-console/src/schemas/schemas.test.js`

- [ ] **Step 1: 写失败测试，验证节点健康输出契约**

在 `frontend/operator-console/src/schemas/schemas.test.js` 的 agent schema import 中加入 `nodeHealthOutputSchema` 和 `readOnlyDiagnosticRequestSchema`：

```js
import {
  nodeHealthOutputSchema,
  readOnlyDiagnosticRequestSchema,
  semanticEventSchema,
  skillRoutingResponseSchema,
} from "./agent-schemas.js";
```

在 `describe("semanticEventSchema", () => { ... })` 后追加：

```js
describe("read-only diagnostic schemas", () => {
  test("accepts the fixed P1 node health diagnostic request", () => {
    expect(
      readOnlyDiagnosticRequestSchema.parse({
        skillId: "node-health-read",
        targetEnvironment: "development",
        idempotencyKey: "agent-workspace-node-health-00000000-0000-4000-8000-000000000001",
        parameters: { nodeName: "node-a" },
      }),
    ).toEqual({
      skillId: "node-health-read",
      targetEnvironment: "development",
      idempotencyKey: "agent-workspace-node-health-00000000-0000-4000-8000-000000000001",
      parameters: { nodeName: "node-a" },
    });
  });

  test("rejects production node health diagnostic requests in the browser contract", () => {
    expect(() =>
      readOnlyDiagnosticRequestSchema.parse({
        skillId: "node-health-read",
        targetEnvironment: "production",
        idempotencyKey: "agent-workspace-node-health-00000000-0000-4000-8000-000000000002",
        parameters: { nodeName: "node-a" },
      }),
    ).toThrow();
  });

  test("accepts node health worker output", () => {
    expect(
      nodeHealthOutputSchema.parse({
        nodeName: "node-a",
        status: "HEALTHY",
        cpuUsagePercent: 18,
        memoryUsagePercent: 42,
        diskUsagePercent: 37,
        lastHeartbeatAt: "2026-06-23T08:00:00Z",
      }),
    ).toMatchObject({ nodeName: "node-a", status: "HEALTHY" });
  });

  test("rejects incomplete node health worker output", () => {
    expect(() =>
      nodeHealthOutputSchema.parse({
        nodeName: "node-a",
        status: "HEALTHY",
      }),
    ).toThrow();
  });
});
```

- [ ] **Step 2: 运行测试并确认失败**

Run:

```powershell
Set-Location frontend/operator-console
npm run test -- src/schemas/schemas.test.js
```

Expected: FAIL，错误包含 `does not provide an export named 'nodeHealthOutputSchema'` 或 `readOnlyDiagnosticRequestSchema` 未导出。

- [ ] **Step 3: 实现最小 Schema**

在 `frontend/operator-console/src/schemas/agent-schemas.js` 的 `semanticEventSchema` 后追加：

```js
export const readOnlyDiagnosticRequestSchema = z
  .object({
    skillId: z.literal("node-health-read"),
    targetEnvironment: z.literal("development"),
    idempotencyKey: nonBlankString,
    parameters: z
      .object({
        nodeName: z.literal("node-a"),
      })
      .strict(),
  })
  .strict();

export const nodeHealthOutputSchema = z
  .object({
    nodeName: nonBlankString,
    status: nonBlankString,
    cpuUsagePercent: z.number().int().min(0).max(100),
    memoryUsagePercent: z.number().int().min(0).max(100),
    diskUsagePercent: z.number().int().min(0).max(100),
    lastHeartbeatAt: z.iso.datetime({ offset: true }),
  })
  .strict();

/**
 * @typedef {z.infer<typeof readOnlyDiagnosticRequestSchema>} ReadOnlyDiagnosticRequest
 * @typedef {z.infer<typeof semanticEventSchema>} SemanticEvent
 * @typedef {z.infer<typeof nodeHealthOutputSchema>} NodeHealthOutput
 */
```

- [ ] **Step 4: 运行测试并确认通过**

Run:

```powershell
Set-Location frontend/operator-console
npm run test -- src/schemas/schemas.test.js
```

Expected: PASS，`schemas.test.js` 全部通过。

- [ ] **Step 5: 提交 Task 1**

```powershell
git add frontend/operator-console/src/schemas/agent-schemas.js frontend/operator-console/src/schemas/schemas.test.js
git commit -m "Add node health diagnostic schemas"
```

---

## Task 2: 增加只读诊断事件流 API

**Files:**
- Modify: `frontend/operator-console/src/api/agent-api.js`
- Test: `frontend/operator-console/src/api/client.test.js`

- [ ] **Step 1: 写失败测试，验证事件流请求和解析**

在 `frontend/operator-console/src/api/client.test.js` 的 agent API import 中加入 `streamReadOnlyDiagnosticEvents`：

```js
import {
  searchSkillCandidates,
  streamReadOnlyDiagnosticEvents,
} from "./agent-api.js";
```

在 `describe("feature API modules", () => { ... })` 内追加：

```js
  test("streams read-only diagnostic semantic events from the control-plane endpoint", async () => {
    /** @type {unknown[]} */
    const calls = [];
    /** @type {unknown[]} */
    const receivedEvents = [];
    server.use(
      http.post("/internal/diagnostics/read-only/events", async ({ request }) => {
        calls.push(await request.json());
        return HttpResponse.text(sseFromEvents(readOnlyDiagnosticEvents), {
          headers: { "Content-Type": "text/event-stream" },
        });
      }),
    );

    await expect(
      streamReadOnlyDiagnosticEvents(readOnlyDiagnosticRequest, {
        onEvent: (event) => receivedEvents.push(event),
      }),
    ).resolves.toHaveLength(4);

    expect(calls).toEqual([readOnlyDiagnosticRequest]);
    expect(receivedEvents.map((event) => event.type)).toEqual([
      "WORKFLOW_STARTED",
      "SKILL_ROUTED",
      "WORKER_ACCEPTED",
      "WORKFLOW_COMPLETED",
    ]);
  });

  test("classifies read-only diagnostic policy denial from the event endpoint", async () => {
    server.use(
      http.post("/internal/diagnostics/read-only/events", () =>
        HttpResponse.json(
          { code: "POLICY_DENIED", message: "role is not sufficient" },
          { status: 403 },
        ),
      ),
    );

    await expect(streamReadOnlyDiagnosticEvents(readOnlyDiagnosticRequest)).rejects.toMatchObject({
      name: "ApiError",
      status: 403,
      kind: "forbidden",
      code: "POLICY_DENIED",
    });
  });
```

在测试文件底部追加 fixtures：

```js
const readOnlyDiagnosticRequest = {
  skillId: "node-health-read",
  targetEnvironment: "development",
  idempotencyKey: "agent-workspace-node-health-00000000-0000-4000-8000-000000000001",
  parameters: { nodeName: "node-a" },
};

const readOnlyDiagnosticEvents = [
  {
    contractVersion: "1.0",
    eventId: "10000000-0000-4000-8000-000000000001",
    workflowId: "20000000-0000-4000-8000-000000000001",
    sequence: 1,
    timestamp: "2026-06-23T08:00:00Z",
    type: "WORKFLOW_STARTED",
    payload: {
      payloadType: "WORKFLOW_STARTED",
      commandId: "30000000-0000-4000-8000-000000000001",
      operatorId: "operator-1",
    },
  },
  {
    contractVersion: "1.0",
    eventId: "10000000-0000-4000-8000-000000000002",
    workflowId: "20000000-0000-4000-8000-000000000001",
    sequence: 2,
    timestamp: "2026-06-23T08:00:01Z",
    type: "SKILL_ROUTED",
    payload: {
      payloadType: "SKILL_ROUTED",
      skillId: "node-health-read",
      skillVersion: "1.1.0",
    },
  },
  {
    contractVersion: "1.0",
    eventId: "10000000-0000-4000-8000-000000000003",
    workflowId: "20000000-0000-4000-8000-000000000001",
    sequence: 3,
    timestamp: "2026-06-23T08:00:02Z",
    type: "WORKER_ACCEPTED",
    payload: {
      payloadType: "WORKER_ACCEPTED",
      executionRequestId: "40000000-0000-4000-8000-000000000001",
    },
  },
  {
    contractVersion: "1.0",
    eventId: "10000000-0000-4000-8000-000000000004",
    workflowId: "20000000-0000-4000-8000-000000000001",
    sequence: 4,
    timestamp: "2026-06-23T08:00:03Z",
    type: "WORKFLOW_COMPLETED",
    payload: {
      payloadType: "WORKFLOW_COMPLETED",
      outputSchemaId: "node-health-read:1.1.0:output",
      output: {
        nodeName: "node-a",
        status: "HEALTHY",
        cpuUsagePercent: 18,
        memoryUsagePercent: 42,
        diskUsagePercent: 37,
        lastHeartbeatAt: "2026-06-23T08:00:03Z",
      },
    },
  },
];

function sseFromEvents(events) {
  return events
    .map((event) => `event:${event.type}\ndata:${JSON.stringify(event)}\n\n`)
    .join("");
}
```

- [ ] **Step 2: 运行测试并确认失败**

Run:

```powershell
Set-Location frontend/operator-console
npm run test -- src/api/client.test.js
```

Expected: FAIL，错误包含 `does not provide an export named 'streamReadOnlyDiagnosticEvents'`。

- [ ] **Step 3: 实现事件流 API**

把 `frontend/operator-console/src/api/agent-api.js` 改为：

```js
import { ZodError } from "zod";

import {
  readOnlyDiagnosticRequestSchema,
  semanticEventSchema,
  skillRoutingRequestSchema,
  skillRoutingResponseSchema,
} from "../schemas/agent-schemas.js";
import { ApiError, requestJson } from "./client.js";

/**
 * @param {unknown} criteria
 */
export function searchSkillCandidates(criteria) {
  const request = skillRoutingRequestSchema.parse(criteria);
  return requestJson("/internal/routing/skills/search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
    schema: skillRoutingResponseSchema,
  });
}

/**
 * @param {unknown} input
 * @param {{ onEvent?: (event: import("../schemas/agent-schemas.js").SemanticEvent) => void, signal?: AbortSignal }} [options]
 * @returns {Promise<import("../schemas/agent-schemas.js").SemanticEvent[]>}
 */
export async function streamReadOnlyDiagnosticEvents(input, options = {}) {
  const request = readOnlyDiagnosticRequestSchema.parse(input);
  let response;
  try {
    response = await fetch("/internal/diagnostics/read-only/events", {
      method: "POST",
      credentials: "include",
      signal: options.signal,
      headers: {
        Accept: "text/event-stream",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(request),
    });
  } catch (cause) {
    throw new ApiError({
      status: 0,
      kind: "network",
      message: "Network request failed",
      cause,
    });
  }

  if (!response.ok) {
    const structuredError = await readStructuredError(response);
    throw new ApiError({
      status: response.status,
      kind:
        response.status === 401
          ? "unauthorized"
          : response.status === 403
            ? "forbidden"
            : "request",
      code: structuredError.code,
      message: structuredError.message ?? `Request failed with HTTP ${response.status}`,
    });
  }

  try {
    const events = await readSseEvents(response, options.onEvent);
    return events;
  } catch (cause) {
    throw new ApiError({
      status: response.status,
      kind: "contract",
      message:
        cause instanceof ZodError
          ? "Response did not match the expected contract"
          : "Response body was not a valid semantic event stream",
      cause,
    });
  }
}

/**
 * @param {Response} response
 * @param {(event: import("../schemas/agent-schemas.js").SemanticEvent) => void | undefined} onEvent
 * @returns {Promise<import("../schemas/agent-schemas.js").SemanticEvent[]>}
 */
async function readSseEvents(response, onEvent) {
  const body = await response.text();
  const frames = body.split(/\r?\n\r?\n/u).filter((frame) => frame.trim());
  /** @type {import("../schemas/agent-schemas.js").SemanticEvent[]} */
  const events = [];

  for (const frame of frames) {
    const data = frame
      .split(/\r?\n/u)
      .filter((line) => line.startsWith("data:"))
      .map((line) => line.slice("data:".length))
      .join("\n");
    if (!data.trim()) {
      continue;
    }
    const event = semanticEventSchema.parse(JSON.parse(data));
    events.push(event);
    onEvent?.(event);
  }

  return events;
}

/**
 * @param {Response} response
 * @returns {Promise<{ code?: string, message?: string }>}
 */
async function readStructuredError(response) {
  const text = await response.text();
  if (!text) {
    return {};
  }
  try {
    const value = JSON.parse(text);
    if (typeof value !== "object" || value === null) {
      return {};
    }
    const error = /** @type {Record<string, unknown>} */ (value);
    return {
      code: readNonBlankString(error.code) ?? readNonBlankString(error.errorCode),
      message: readNonBlankString(error.message),
    };
  } catch {
    return {};
  }
}

/**
 * @param {unknown} value
 * @returns {string | undefined}
 */
function readNonBlankString(value) {
  return typeof value === "string" && value.trim() ? value : undefined;
}
```

- [ ] **Step 4: 运行测试并确认通过**

Run:

```powershell
Set-Location frontend/operator-console
npm run test -- src/api/client.test.js
```

Expected: PASS，`client.test.js` 全部通过。

- [ ] **Step 5: 提交 Task 2**

```powershell
git add frontend/operator-console/src/api/agent-api.js frontend/operator-console/src/api/client.test.js
git commit -m "Add read-only diagnostic event API"
```

---

## Task 3: 增加 Agent 工作区只读诊断状态 Hook

**Files:**
- Create: `frontend/operator-console/src/features/agent-workspace/use-read-only-diagnostic-workflow.js`
- Test: `frontend/operator-console/src/features/agent-workspace/AgentWorkspacePage.test.jsx`

- [ ] **Step 1: 写失败测试，验证成功事件流和结果展示**

在 `frontend/operator-console/src/features/agent-workspace/AgentWorkspacePage.test.jsx` 的 `defaultHandlers` 中追加事件流 handler：

```js
  http.post("/internal/diagnostics/read-only/events", async ({ request }) => {
    diagnosticRequests.push(await request.json());
    return HttpResponse.text(sseFromEvents(readOnlyDiagnosticEvents), {
      headers: { "Content-Type": "text/event-stream" },
    });
  }),
```

在文件级声明请求记录：

```js
/** @type {unknown[]} */
let diagnosticRequests = [];
```

在 `beforeEach` 中重置：

```js
beforeEach(() => {
  diagnosticRequests = [];
  server.use(...defaultHandlers);
});
```

把测试 `"renders the read-only workspace from real routing candidates"` 中的发送按钮断言改成可用：

```js
expect(screen.getByRole("button", { name: "发送任务" })).toBeEnabled();
```

新增测试：

```js
  test("runs node health read-only diagnostic and renders semantic events with worker output", async () => {
    const user = userEvent.setup();
    vi.spyOn(crypto, "randomUUID").mockReturnValue("00000000-0000-4000-8000-000000000001");

    renderPage();

    await user.click(await screen.findByRole("button", { name: "发送任务" }));

    expect(await screen.findByText("WORKFLOW_STARTED")).toBeInTheDocument();
    expect(screen.getByText("SKILL_ROUTED")).toBeInTheDocument();
    expect(screen.getByText("WORKER_ACCEPTED")).toBeInTheDocument();
    expect(screen.getByText("WORKFLOW_COMPLETED")).toBeInTheDocument();
    expect(await screen.findByText("CPU 18%")).toBeInTheDocument();
    expect(screen.getByText("内存 42%")).toBeInTheDocument();
    expect(screen.getByText("磁盘 37%")).toBeInTheDocument();
    expect(screen.getByText("HEALTHY")).toBeInTheDocument();
    expect(diagnosticRequests).toEqual([
      {
        skillId: "node-health-read",
        targetEnvironment: "development",
        idempotencyKey: "agent-workspace-node-health-00000000-0000-4000-8000-000000000001",
        parameters: { nodeName: "node-a" },
      },
    ]);
  });
```

在文件底部追加事件 fixtures 和 helper：

```js
const readOnlyDiagnosticEvents = [
  {
    contractVersion: "1.0",
    eventId: "10000000-0000-4000-8000-000000000001",
    workflowId: "20000000-0000-4000-8000-000000000001",
    sequence: 1,
    timestamp: "2026-06-23T08:00:00Z",
    type: "WORKFLOW_STARTED",
    payload: {
      payloadType: "WORKFLOW_STARTED",
      commandId: "30000000-0000-4000-8000-000000000001",
      operatorId: "operator-1",
    },
  },
  {
    contractVersion: "1.0",
    eventId: "10000000-0000-4000-8000-000000000002",
    workflowId: "20000000-0000-4000-8000-000000000001",
    sequence: 2,
    timestamp: "2026-06-23T08:00:01Z",
    type: "SKILL_ROUTED",
    payload: {
      payloadType: "SKILL_ROUTED",
      skillId: "node-health-read",
      skillVersion: "1.1.0",
    },
  },
  {
    contractVersion: "1.0",
    eventId: "10000000-0000-4000-8000-000000000003",
    workflowId: "20000000-0000-4000-8000-000000000001",
    sequence: 3,
    timestamp: "2026-06-23T08:00:02Z",
    type: "WORKER_ACCEPTED",
    payload: {
      payloadType: "WORKER_ACCEPTED",
      executionRequestId: "40000000-0000-4000-8000-000000000001",
    },
  },
  {
    contractVersion: "1.0",
    eventId: "10000000-0000-4000-8000-000000000004",
    workflowId: "20000000-0000-4000-8000-000000000001",
    sequence: 4,
    timestamp: "2026-06-23T08:00:03Z",
    type: "WORKFLOW_COMPLETED",
    payload: {
      payloadType: "WORKFLOW_COMPLETED",
      outputSchemaId: "node-health-read:1.1.0:output",
      output: {
        nodeName: "node-a",
        status: "HEALTHY",
        cpuUsagePercent: 18,
        memoryUsagePercent: 42,
        diskUsagePercent: 37,
        lastHeartbeatAt: "2026-06-23T08:00:03Z",
      },
    },
  },
];

function sseFromEvents(events) {
  return events
    .map((event) => `event:${event.type}\ndata:${JSON.stringify(event)}\n\n`)
    .join("");
}
```

- [ ] **Step 2: 运行测试并确认失败**

Run:

```powershell
Set-Location frontend/operator-console
npm run test -- src/features/agent-workspace/AgentWorkspacePage.test.jsx
```

Expected: FAIL，发送按钮仍是 disabled，页面没有 `WORKFLOW_STARTED` 和节点健康结果。

- [ ] **Step 3: 创建状态 Hook**

创建 `frontend/operator-console/src/features/agent-workspace/use-read-only-diagnostic-workflow.js`：

```js
import { useCallback, useMemo, useState } from "react";

import { streamReadOnlyDiagnosticEvents } from "../../api/agent-api.js";
import { ApiError } from "../../api/client.js";
import { nodeHealthOutputSchema } from "../../schemas/agent-schemas.js";

const NODE_HEALTH_REQUEST_BASE = {
  skillId: "node-health-read",
  targetEnvironment: "development",
  parameters: { nodeName: "node-a" },
};

const initialState = {
  status: "idle",
  events: [],
  output: null,
  errorCode: null,
  errorMessage: null,
  workflowId: null,
};

export function useReadOnlyDiagnosticWorkflow() {
  const [state, setState] = useState(initialState);

  const latestEvent = state.events.at(-1) ?? null;

  const run = useCallback(async () => {
    const idempotencyKey = `agent-workspace-node-health-${crypto.randomUUID()}`;
    setState({
      ...initialState,
      status: "running",
    });

    try {
      await streamReadOnlyDiagnosticEvents(
        {
          ...NODE_HEALTH_REQUEST_BASE,
          idempotencyKey,
        },
        {
          onEvent: (event) => {
            setState((current) => reduceDiagnosticEvent(current, event));
          },
        },
      );
    } catch (error) {
      setState((current) => ({
        ...current,
        status: classifyFailure(error),
        errorCode: error instanceof ApiError ? error.code ?? null : "DIAGNOSTIC_REQUEST_FAILED",
        errorMessage: error instanceof Error ? error.message : "Diagnostic request failed",
      }));
    }
  }, []);

  return useMemo(
    () => ({
      ...state,
      latestEvent,
      run,
    }),
    [latestEvent, run, state],
  );
}

/**
 * @param {typeof initialState} current
 * @param {import("../../schemas/agent-schemas.js").SemanticEvent} event
 * @returns {typeof initialState}
 */
function reduceDiagnosticEvent(current, event) {
  const eventsById = new Map(current.events.map((existing) => [existing.eventId, existing]));
  eventsById.set(event.eventId, event);
  const events = [...eventsById.values()].sort((left, right) => left.sequence - right.sequence);

  if (event.type === "WORKFLOW_COMPLETED") {
    const parsed = nodeHealthOutputSchema.safeParse(event.payload.output);
    if (!parsed.success) {
      return {
        ...current,
        status: "contractError",
        events,
        workflowId: event.workflowId,
        output: null,
        errorCode: "NODE_HEALTH_OUTPUT_CONTRACT_MISMATCH",
        errorMessage: "Node health output did not match the expected contract",
      };
    }
    return {
      ...current,
      status: "succeeded",
      events,
      workflowId: event.workflowId,
      output: parsed.data,
      errorCode: null,
      errorMessage: null,
    };
  }

  if (event.type === "WORKFLOW_FAILED") {
    return {
      ...current,
      status: "failed",
      events,
      workflowId: event.workflowId,
      output: null,
      errorCode: event.payload.errorCode,
      errorMessage: event.payload.message,
    };
  }

  return {
    ...current,
    status: "running",
    events,
    workflowId: event.workflowId,
  };
}

/**
 * @param {unknown} error
 * @returns {"denied" | "contractError" | "failed"}
 */
function classifyFailure(error) {
  if (error instanceof ApiError && error.kind === "forbidden") {
    return "denied";
  }
  if (error instanceof ApiError && error.kind === "contract") {
    return "contractError";
  }
  return "failed";
}
```

- [ ] **Step 4: 运行测试并确认仍失败在页面渲染**

Run:

```powershell
Set-Location frontend/operator-console
npm run test -- src/features/agent-workspace/AgentWorkspacePage.test.jsx
```

Expected: FAIL，错误从“按钮禁用或 Hook 不存在”推进到页面尚未使用 Hook 或未展示事件。

- [ ] **Step 5: 提交 Task 3**

如果仅新增 Hook 且测试仍因页面未接入而失败，不提交。把提交延后到 Task 4 页面接入后一起提交，保证每次提交保持测试可通过。

---

## Task 4: 接入 Agent 工作区页面并渲染事件和结果

**Files:**
- Modify: `frontend/operator-console/src/features/agent-workspace/AgentWorkspacePage.jsx`
- Modify: `frontend/operator-console/src/features/agent-workspace/AgentWorkspacePage.module.css`
- Test: `frontend/operator-console/src/features/agent-workspace/AgentWorkspacePage.test.jsx`

- [ ] **Step 1: 修改页面引入 Hook 并启用按钮**

在 `AgentWorkspacePage.jsx` import 中增加：

```js
import { useReadOnlyDiagnosticWorkflow } from "./use-read-only-diagnostic-workflow.js";
```

在 `AgentWorkspacePage` 组件中加入：

```js
  const diagnosticWorkflow = useReadOnlyDiagnosticWorkflow();
  const nodeHealthCandidate = candidates.find(
    (candidate) => candidate.skill.descriptor.skillId === "node-health-read",
  );
  const canRunDiagnostic =
    Boolean(nodeHealthCandidate) &&
    !candidatesQuery.isLoading &&
    !candidatesQuery.error &&
    diagnosticWorkflow.status !== "running";
  const currentWorkflowTask = toCurrentWorkflowTask(diagnosticWorkflow);
```

把 workflow 列表渲染改为：

```jsx
            {currentWorkflowTask ? <WorkflowTaskCard task={currentWorkflowTask} /> : null}
            {workflowTasks.map((task) => (
              <WorkflowTaskCard key={task.attempt} task={task} />
            ))}
```

把发送按钮改为：

```jsx
                <Button
                  aria-label="发送任务"
                  className={styles.sendButton}
                  disabled={!canRunDiagnostic}
                  onClick={diagnosticWorkflow.run}
                  variant="primary"
                >
                  <SendHorizontal aria-hidden="true" size={18} />
                </Button>
```

侧栏组件调用改为：

```jsx
          <TaskDetailPanel workflow={diagnosticWorkflow} />
          <SkillEventPanel candidates={candidates} query={candidatesQuery} workflow={diagnosticWorkflow} />
          <SessionContextPanel workflow={diagnosticWorkflow} />
```

- [ ] **Step 2: 增加页面转换函数和渲染分支**

在 `AgentWorkspacePage.jsx` 中 `WorkflowTaskCard` 前加入：

```js
function toCurrentWorkflowTask(workflow) {
  if (workflow.status === "idle") {
    return null;
  }
  const eventCount = workflow.events.length;
  return {
    actions: workflow.events.map((event) => event.type),
    attempt: `${workflow.workflowId ?? "pending"} · node-health-read@1.1.0 · attempt 1`,
    state: workflowStateLabel(workflow.status),
    tone: workflow.status === "succeeded" ? "success" : workflow.status === "failed" ? "danger" : "info",
    title: "当前节点健康检查",
    tags: ["development", "node-a", "READ_ONLY", `sequence ${eventCount}`],
    progress: Math.min(eventCount, 4),
    output: workflow.output,
    errorCode: workflow.errorCode,
    errorMessage: workflow.errorMessage,
  };
}

function workflowStateLabel(status) {
  const labels = {
    idle: "未开始",
    running: "执行中",
    succeeded: "已完成",
    failed: "失败",
    denied: "已拒绝",
    contractError: "契约错误",
  };
  return labels[status] ?? "未知";
}
```

修改 `WorkflowTaskCard` 的 JSDoc，加上可选字段：

```js
 *     output?: import("../../schemas/agent-schemas.js").NodeHealthOutput | null,
 *     errorCode?: string | null,
 *     errorMessage?: string | null,
```

在 `WorkflowTaskCard` 的 actions 后追加：

```jsx
      {task.output ? <NodeHealthResult output={task.output} /> : null}
      {task.errorCode ? (
        <div className={styles.workflowError}>
          <strong>{task.errorCode}</strong>
          <span>{task.errorMessage}</span>
        </div>
      ) : null}
```

新增结果组件：

```js
/**
 * @param {{output: import("../../schemas/agent-schemas.js").NodeHealthOutput}} props
 */
function NodeHealthResult({ output }) {
  return (
    <div className={styles.nodeHealthResult}>
      <span>{output.status}</span>
      <span>CPU {output.cpuUsagePercent}%</span>
      <span>内存 {output.memoryUsagePercent}%</span>
      <span>磁盘 {output.diskUsagePercent}%</span>
      <span>{output.lastHeartbeatAt}</span>
    </div>
  );
}
```

- [ ] **Step 3: 修改侧栏组件展示最新事件和结果**

把 `TaskDetailPanel` 改为接收 workflow：

```js
function TaskDetailPanel({ workflow }) {
  return (
    <section className={styles.agentPanel}>
      <h3>
        <span aria-hidden="true" className={`${styles.panelIcon} ${styles.panelIconTask}`}>
          <ClipboardCheck size={15} strokeWidth={2.6} />
        </span>
        选中任务详情
      </h3>
      <MiniRow label="workflow" value={workflow.workflowId ?? "pending"} />
      <MiniRow label="状态" tone="info" value={workflowStateLabel(workflow.status)} />
      <MiniRow label="策略" tone="ok" value="READ_ONLY" />
    </section>
  );
}
```

把 `SkillEventPanel` 改为：

```js
function SkillEventPanel({ candidates, query, workflow }) {
  const primaryCandidate = candidates[0];
  const latestEventType = workflow.latestEvent?.type ?? "等待发送";
  const skillValue = query.isLoading
    ? "loading"
    : query.error
      ? "unavailable"
      : primaryCandidate?.skill.descriptor.skillId ?? "dependency";

  return (
    <section className={styles.agentPanel}>
      <h3>
        <span aria-hidden="true" className={`${styles.panelIcon} ${styles.panelIconSkill}`}>
          <GitBranch size={15} strokeWidth={2.6} />
        </span>
        Skill 与事件
      </h3>
      <MiniRow label="Skill" tone="info" value={skillValue} />
      <MiniRow label="最近事件" tone="info" value={latestEventType} />
      <MiniRow label="sequence" tone="info" value={`${workflow.events.length} / 4`} />
    </section>
  );
}
```

把 `SessionContextPanel` 增加状态说明：

```js
function SessionContextPanel({ workflow }) {
  return (
    <section className={`${styles.agentPanel} ${styles.scanLine}`}>
      <h3>
        <span aria-hidden="true" className={`${styles.panelIcon} ${styles.panelIconSession}`}>
          <ShieldCheck size={15} strokeWidth={2.6} />
        </span>
        会话上下文
      </h3>
      <MiniRow label="目标" tone="info" value="node-a" />
      <MiniRow label="关联工单" tone="info" value="INC-2841" />
      <MiniRow label="自动模式" tone="ok" value="只读触发" />
      <MiniRow label="状态" tone="info" value={workflowStateLabel(workflow.status)} />
      <div className={workflow.status === "denied" ? styles.errorNote : styles.statusNote}>
        <ShieldCheck aria-hidden="true" size={16} />
        {workflow.errorMessage ?? "仅展示可审计计划摘要、事件状态和服务端候选 Skill。"}
      </div>
    </section>
  );
}
```

- [ ] **Step 4: 增加样式**

在 `AgentWorkspacePage.module.css` 中追加：

```css
.workflowTaskCard.danger {
  --task-state: var(--agent-red);
}

.nodeHealthResult {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  padding-top: 3px;
}

.nodeHealthResult span {
  display: inline-flex;
  min-height: 24px;
  align-items: center;
  padding: 0 9px;
  border: 1px solid rgba(27, 139, 96, 0.18);
  border-radius: 999px;
  background: rgba(27, 139, 96, 0.08);
  color: var(--agent-green);
  font-size: 10px;
  font-weight: 900;
  white-space: nowrap;
}

.workflowError,
.errorNote {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 8px;
  border: 1px solid rgba(211, 17, 69, 0.16);
  border-radius: 12px;
  background: rgba(211, 17, 69, 0.06);
  color: var(--agent-red);
  font-size: 11px;
  font-weight: 850;
  line-height: 1.45;
}

.workflowError {
  display: grid;
  gap: 2px;
}

.workflowError strong {
  color: var(--agent-red);
  font-size: 11px;
}

.workflowError span {
  color: #7a3f50;
}
```

- [ ] **Step 5: 运行测试并确认通过**

Run:

```powershell
Set-Location frontend/operator-console
npm run test -- src/features/agent-workspace/AgentWorkspacePage.test.jsx
```

Expected: PASS，Agent 工作区测试全部通过。

- [ ] **Step 6: 提交 Task 3 和 Task 4**

```powershell
git add frontend/operator-console/src/features/agent-workspace/use-read-only-diagnostic-workflow.js frontend/operator-console/src/features/agent-workspace/AgentWorkspacePage.jsx frontend/operator-console/src/features/agent-workspace/AgentWorkspacePage.module.css frontend/operator-console/src/features/agent-workspace/AgentWorkspacePage.test.jsx
git commit -m "Run read-only diagnostics from agent workspace"
```

---

## Task 5: 补齐拒绝、失败和契约错误测试

**Files:**
- Modify: `frontend/operator-console/src/features/agent-workspace/AgentWorkspacePage.test.jsx`
- Modify if required: `frontend/operator-console/src/features/agent-workspace/use-read-only-diagnostic-workflow.js`
- Modify if required: `frontend/operator-console/src/features/agent-workspace/AgentWorkspacePage.jsx`

- [ ] **Step 1: 写失败测试，覆盖事件端点 403**

在 `AgentWorkspacePage.test.jsx` 中追加：

```js
  test("shows policy denial from the diagnostic event endpoint", async () => {
    const user = userEvent.setup();
    server.use(
      http.post("/internal/diagnostics/read-only/events", () =>
        HttpResponse.json(
          { code: "POLICY_DENIED", message: "role is not sufficient" },
          { status: 403 },
        ),
      ),
    );

    renderPage();

    await user.click(await screen.findByRole("button", { name: "发送任务" }));

    expect(await screen.findByText("POLICY_DENIED")).toBeInTheDocument();
    expect(screen.getByText("role is not sufficient")).toBeInTheDocument();
  });
```

- [ ] **Step 2: 写失败测试，覆盖 WORKFLOW_FAILED**

追加：

```js
  test("renders workflow failure returned by the read-only diagnostic stream", async () => {
    const user = userEvent.setup();
    server.use(
      http.post("/internal/diagnostics/read-only/events", () =>
        HttpResponse.text(sseFromEvents([readOnlyDiagnosticEvents[0], workflowFailedEvent]), {
          headers: { "Content-Type": "text/event-stream" },
        }),
      ),
    );

    renderPage();

    await user.click(await screen.findByRole("button", { name: "发送任务" }));

    expect(await screen.findByText("WORKFLOW_FAILED")).toBeInTheDocument();
    expect(screen.getByText("INVALID_PARAMETERS")).toBeInTheDocument();
    expect(screen.getByText("nodeName is required")).toBeInTheDocument();
  });
```

在 fixtures 中加入：

```js
const workflowFailedEvent = {
  contractVersion: "1.0",
  eventId: "10000000-0000-4000-8000-000000000005",
  workflowId: "20000000-0000-4000-8000-000000000001",
  sequence: 2,
  timestamp: "2026-06-23T08:00:01Z",
  type: "WORKFLOW_FAILED",
  payload: {
    payloadType: "WORKFLOW_FAILED",
    errorCode: "INVALID_PARAMETERS",
    message: "nodeName is required",
  },
};
```

- [ ] **Step 3: 写失败测试，覆盖输出契约错误**

追加：

```js
  test("shows contract error when completed node health output is invalid", async () => {
    const user = userEvent.setup();
    const invalidCompletedEvent = {
      ...readOnlyDiagnosticEvents[3],
      payload: {
        payloadType: "WORKFLOW_COMPLETED",
        outputSchemaId: "node-health-read:1.1.0:output",
        output: { nodeName: "node-a", status: "HEALTHY" },
      },
    };
    server.use(
      http.post("/internal/diagnostics/read-only/events", () =>
        HttpResponse.text(sseFromEvents([readOnlyDiagnosticEvents[0], invalidCompletedEvent]), {
          headers: { "Content-Type": "text/event-stream" },
        }),
      ),
    );

    renderPage();

    await user.click(await screen.findByRole("button", { name: "发送任务" }));

    expect(await screen.findByText("NODE_HEALTH_OUTPUT_CONTRACT_MISMATCH")).toBeInTheDocument();
    expect(screen.getByText("Node health output did not match the expected contract")).toBeInTheDocument();
  });
```

- [ ] **Step 4: 运行测试并确认失败或定位缺口**

Run:

```powershell
Set-Location frontend/operator-console
npm run test -- src/features/agent-workspace/AgentWorkspacePage.test.jsx
```

Expected: 若 Task 4 已完整实现，可能直接 PASS；如果失败，应只因拒绝、失败或契约错误未展示完整。

- [ ] **Step 5: 最小修正失败展示**

如果 `POLICY_DENIED` 没有展示，确认 `SessionContextPanel` 和 `WorkflowTaskCard` 都使用 `workflow.errorCode`。在 `SessionContextPanel` 的提示内容中保留：

```jsx
        {workflow.errorCode ? (
          <strong>{workflow.errorCode}</strong>
        ) : null}
        <span>{workflow.errorMessage ?? "仅展示可审计计划摘要、事件状态和服务端候选 Skill。"}</span>
```

如果 `WORKFLOW_FAILED` 没有展示，确认 `WorkflowTaskCard` 的 actions 仍渲染事件类型：

```jsx
      <div className={styles.workflowTaskActions}>
        {task.actions.map((action) => (
          <span key={action}>{action}</span>
        ))}
      </div>
```

如果契约错误没有展示，确认 Hook 的 `WORKFLOW_COMPLETED` 分支使用 `nodeHealthOutputSchema.safeParse`，且失败时设置：

```js
status: "contractError",
errorCode: "NODE_HEALTH_OUTPUT_CONTRACT_MISMATCH",
errorMessage: "Node health output did not match the expected contract",
```

- [ ] **Step 6: 运行测试并确认通过**

Run:

```powershell
Set-Location frontend/operator-console
npm run test -- src/features/agent-workspace/AgentWorkspacePage.test.jsx
```

Expected: PASS，Agent 工作区测试全部通过。

- [ ] **Step 7: 提交 Task 5**

```powershell
git add frontend/operator-console/src/features/agent-workspace/AgentWorkspacePage.test.jsx frontend/operator-console/src/features/agent-workspace/use-read-only-diagnostic-workflow.js frontend/operator-console/src/features/agent-workspace/AgentWorkspacePage.jsx
git commit -m "Handle agent diagnostic failure states"
```

---

## Task 6: 运行质量门禁并做浏览器验收

**Files:**
- Verify only unless tests require small fixes.

- [ ] **Step 1: 运行前端目标测试**

Run:

```powershell
Set-Location frontend/operator-console
npm run test -- src/schemas/schemas.test.js src/api/client.test.js src/features/agent-workspace/AgentWorkspacePage.test.jsx
```

Expected: PASS，目标测试全部通过。

- [ ] **Step 2: 运行前端静态检查**

Run:

```powershell
Set-Location frontend/operator-console
npm run check
npm run lint
```

Expected: 两条命令均退出码 0，无 TypeScript `checkJs` 或 ESLint 错误。

- [ ] **Step 3: 运行前端测试全集**

Run:

```powershell
Set-Location frontend/operator-console
npm run test
```

Expected: PASS，Vitest 全部通过。

- [ ] **Step 4: 运行前端生产构建**

Run:

```powershell
Set-Location frontend/operator-console
npm run build
```

Expected: PASS，Vite build 成功。

- [ ] **Step 5: 运行后端相关测试确认接口未破坏**

Run:

```powershell
Set-Location backend
.\mvnw.cmd -pl control-plane/bootstrap -Dtest=ControlPlaneApplicationTest test
.\mvnw.cmd -pl execution-worker -Dtest=RestrictedReadOnlyExecutionWorkerTest test
```

Expected: 两条命令均 BUILD SUCCESS。

- [ ] **Step 6: 启动本地 Worker、控制面和操作台**

终端 1：

```powershell
Set-Location backend
.\mvnw.cmd -f .\execution-worker\pom.xml spring-boot:run
```

Expected: Worker 监听 `127.0.0.1:8091`。

终端 2：

```powershell
Set-Location backend
.\mvnw.cmd -f .\control-plane\bootstrap\pom.xml spring-boot:run
```

Expected: 控制面监听默认端口，启动时加载 `backend/skills`。

终端 3：

```powershell
Set-Location frontend/operator-console
npm run dev
```

Expected: Vite 输出本地访问 URL。

- [ ] **Step 7: 浏览器验收 Agent 工作区**

在浏览器打开 Vite URL 的 `/agent`。

Expected:

- 页面仍保持现有 Agent 工作区视觉布局。
- 候选 Skill 可用时发送按钮启用。
- 点击发送后出现 `WORKFLOW_STARTED`、`SKILL_ROUTED`、`WORKER_ACCEPTED`、`WORKFLOW_COMPLETED`。
- 页面展示 `HEALTHY`、`CPU 18%`、`内存 42%`、`磁盘 37%`。
- 页面没有“模型内部推理”文案。
- 浏览器控制台没有运行时异常。

- [ ] **Step 8: 最终提交验证修正**

如果 Task 6 中只做了小修正：

```powershell
git add frontend/operator-console/src
git commit -m "Verify agent workspace diagnostic flow"
```

如果没有文件变化，不创建空提交。

---

## 自检记录

- Spec 覆盖：本计划覆盖发送按钮启用、事件流 API、强类型事件渲染、节点健康结果展示、拒绝/失败/契约错误、前端不直接调用 Worker、不开启 AgentRuntime 和本地验收。
- 占位扫描：计划中没有未完成标记或未定义的延迟步骤。
- 类型一致性：核心新增类型为 `ReadOnlyDiagnosticRequest`、`SemanticEvent`、`NodeHealthOutput`；Hook 状态只在前端展示使用，不作为授权事实源。
