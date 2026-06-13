# M09 基于原型的操作台首轮重写实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 删除现有操作台页面实现，基于已批准原型重新实现登录页、Agent 工作台、Skill 注册中心和 SQL 工作台，并优先接入现有真实接口。

**Architecture:** 操作台继续作为 React/Vite 单页应用部署，但业务代码改用 JavaScript、JSX、JSDoc 和 `checkJs`。应用按 `app`、`api`、`schemas`、共享组件和四个功能切片组织；所有外部数据先通过 Zod 校验，再进入 TanStack Query 和页面。路由仅管理页面可见性，授权、安全和执行状态始终来自控制面。

**Tech Stack:** React 19、JavaScript/JSX、JSDoc、TypeScript `checkJs`、Vite 8、React Router、TanStack Query、Zod、Lucide React、Monaco Editor、CSS Modules、Vitest、React Testing Library、Mock Service Worker、Playwright

---

## 实施前边界

- 当前工作区存在用户未提交的 SQL 工作台和后端改动。只删除和重写 `frontend/operator-console` 中已明确授权替换的页面代码，不回退任何后端改动。
- `backend/control-plane/bootstrap/src/main/java/.../SqlWorkbenchController.java` 及 `backend/contracts/sqlworkbench/` 当前为未提交文件，但计划将其视为已有真实接口。执行 SQL 页面任务前必须确认这些文件仍存在。
- 不修改控制面授权链路，不新增生产写操作，不新增通用 Agent 对话后端接口。
- Agent 工作台首轮使用真实 Skill 目录和路由搜索接口展示候选能力；任务发送与执行保持禁用。
- Mock Service Worker 仅用于测试，不得从生产入口导入。
- 每次提交只暂存该任务列出的文件，避免纳入工作区其他改动。

## 文件结构锁定

实施后主要文件职责如下：

```text
frontend/operator-console/
|-- eslint.config.js
|-- jsconfig.json
|-- playwright.config.js
|-- vite.config.js
|-- package.json
|-- src/
|   |-- main.jsx
|   |-- app/
|   |   |-- App.jsx
|   |   |-- providers.jsx
|   |   `-- router.jsx
|   |-- api/
|   |   |-- client.js
|   |   |-- auth-api.js
|   |   |-- agent-api.js
|   |   |-- skill-api.js
|   |   `-- sql-api.js
|   |-- schemas/
|   |   |-- auth-schemas.js
|   |   |-- agent-schemas.js
|   |   |-- skill-schemas.js
|   |   `-- sql-schemas.js
|   |-- components/
|   |   |-- layout/
|   |   |-- primitives/
|   |   |-- feedback/
|   |   `-- data-display/
|   |-- features/
|   |   |-- auth/
|   |   |-- agent-workspace/
|   |   |-- skill-registry/
|   |   `-- sql-workbench/
|   |-- styles/
|   |   |-- tokens.css
|   |   |-- reset.css
|   |   `-- global.css
|   `-- test/
|       |-- handlers.js
|       |-- server.js
|       `-- setup.js
`-- tests/e2e/
    |-- app-navigation.spec.js
    `-- sql-workbench.spec.js
```

旧文件 `src/App.tsx`、`src/api.ts`、`src/styles.css`、`src/types.ts`、`src/main.tsx`、`tsconfig.app.json`、`tsconfig.node.json`、`tsconfig.json` 和 `vite.config.ts` 在对应任务中删除或替换，不继续扩展。

### Task 1: 修订技术决策并迁移 JavaScript 工具链

**Files:**
- Modify: `docs/adr/0003-operator-console-toolchain.md`
- Modify: `AGENTS.md`
- Modify: `frontend/operator-console/package.json`
- Modify: `frontend/operator-console/package-lock.json`
- Create: `frontend/operator-console/jsconfig.json`
- Create: `frontend/operator-console/eslint.config.js`
- Create: `frontend/operator-console/vite.config.js`
- Delete: `frontend/operator-console/tsconfig.json`
- Delete: `frontend/operator-console/tsconfig.app.json`
- Delete: `frontend/operator-console/tsconfig.node.json`
- Delete: `frontend/operator-console/vite.config.ts`

- [ ] **Step 1: 在 ADR 中记录 JavaScript 决策变化**

将 ADR 0003 的决策更新为：

```markdown
操作台采用 React、JavaScript/JSX、JSDoc、TypeScript `checkJs` 和 Vite。
所有外部 API 与 SSE 数据必须通过 Zod 做运行时校验。路由和查询缓存不得承载授权决策或作为执行事实源。
```

同步将 `AGENTS.md` 前端技术基线和 TypeScript 规则调整为 JavaScript/JSX、JSDoc、`checkJs` 与外部边界 Zod 校验要求。不要修改其他模块规则。

- [ ] **Step 2: 安装运行与测试依赖**

Run:

```powershell
Set-Location frontend/operator-console
npm install react-router-dom @tanstack/react-query zod lucide-react @monaco-editor/react
npm install --save-dev typescript eslint @eslint/js globals eslint-plugin-react-hooks eslint-plugin-react-refresh vitest jsdom @testing-library/react @testing-library/jest-dom @testing-library/user-event msw @playwright/test
```

Expected: `package.json` 和 `package-lock.json` 更新，命令退出码为 `0`。

- [ ] **Step 3: 配置脚本与 JavaScript 静态检查**

将 `package.json` scripts 设置为：

```json
{
  "scripts": {
    "dev": "vite",
    "check": "tsc --noEmit -p jsconfig.json",
    "lint": "eslint .",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:e2e": "playwright test",
    "build": "npm run check && npm run lint && npm run test && vite build",
    "preview": "vite preview"
  }
}
```

创建 `jsconfig.json`：

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "jsx": "react-jsx",
    "allowJs": true,
    "checkJs": true,
    "noEmit": true,
    "strict": true,
    "skipLibCheck": true,
    "resolveJsonModule": true
  },
  "include": ["src", "vite.config.js", "playwright.config.js"]
}
```

将现有 Vite 代理配置迁移至 `vite.config.js`，保留 `/internal`、`/auth`、`/oauth2`、`/login`、`/logout`、`/mock-oidc` 和 `/.well-known` 代理。

- [ ] **Step 4: 配置 ESLint**

创建 `eslint.config.js`，启用 JavaScript recommended、浏览器全局变量、React Hooks 和 React Refresh；忽略 `dist`、`coverage` 与 Playwright 报告目录。

- [ ] **Step 5: 验证依赖许可证**

Run:

```powershell
npm view react-router-dom license
npm view @tanstack/react-query license
npm view zod license
npm view lucide-react license
npm view @monaco-editor/react license
npm view @playwright/test license
```

Expected: 运行时依赖为宽松许可证；若实际结果与设计文档不同，先更新设计/ADR 再继续。

- [ ] **Step 6: 运行 JavaScript 工具链静态检查**

Run:

```powershell
npm run check
```

Expected: 退出码为 `0`。此时旧 `.tsx` 页面仍可被 TypeScript 检查器读取，但后续任务会删除并替换它们。

- [ ] **Step 7: 提交工具链和决策变更**

```powershell
git add AGENTS.md docs/adr/0003-operator-console-toolchain.md frontend/operator-console/package.json frontend/operator-console/package-lock.json frontend/operator-console/jsconfig.json frontend/operator-console/eslint.config.js frontend/operator-console/vite.config.js frontend/operator-console/tsconfig.json frontend/operator-console/tsconfig.app.json frontend/operator-console/tsconfig.node.json frontend/operator-console/vite.config.ts
git commit -m "Adopt JavaScript operator console toolchain"
```

### Task 2: 建立测试基线并移除旧页面入口

**Files:**
- Delete: `frontend/operator-console/src/App.tsx`
- Delete: `frontend/operator-console/src/api.ts`
- Delete: `frontend/operator-console/src/styles.css`
- Delete: `frontend/operator-console/src/types.ts`
- Delete: `frontend/operator-console/src/main.tsx`
- Create: `frontend/operator-console/src/main.jsx`
- Create: `frontend/operator-console/src/app/App.jsx`
- Create: `frontend/operator-console/src/app/providers.jsx`
- Create: `frontend/operator-console/src/test/setup.js`
- Create: `frontend/operator-console/src/test/server.js`
- Create: `frontend/operator-console/src/test/handlers.js`
- Create: `frontend/operator-console/src/app/App.test.jsx`
- Modify: `frontend/operator-console/vite.config.js`

- [ ] **Step 1: 写应用启动失败测试**

创建 `src/app/App.test.jsx`：

```jsx
import { render, screen } from "@testing-library/react";
import { App } from "./App";

test("renders the operator console application root", () => {
  render(<App />);
  expect(screen.getByText("智能运维 Agent")).toBeInTheDocument();
});
```

- [ ] **Step 2: 运行测试确认失败**

Run:

```powershell
npm run test -- src/app/App.test.jsx
```

Expected: FAIL，原因是 `App.jsx` 尚不存在或未导出 `App`。

- [ ] **Step 3: 创建测试基础设施**

`src/test/server.js`：

```js
import { setupServer } from "msw/node";
import { handlers } from "./handlers";

export const server = setupServer(...handlers);
```

`src/test/setup.js`：

```js
import "@testing-library/jest-dom/vitest";
import { afterAll, afterEach, beforeAll } from "vitest";
import { server } from "./server";

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
```

`src/test/handlers.js` 初始只返回空数组：

```js
export const handlers = [];
```

在 `vite.config.js` 增加 Vitest 配置：

```js
test: {
  environment: "jsdom",
  setupFiles: "./src/test/setup.js"
}
```

- [ ] **Step 4: 创建最小应用入口**

`src/app/providers.jsx` 创建 `QueryClientProvider` 和 `MemoryRouter/BrowserRouter` 可注入包装器；测试环境不得共享 QueryClient。

`src/app/App.jsx`：

```jsx
export function App() {
  return <div>智能运维 Agent</div>;
}
```

`src/main.jsx`：

```jsx
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { AppProviders } from "./app/providers";
import { App } from "./app/App";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <AppProviders>
      <App />
    </AppProviders>
  </StrictMode>,
);
```

- [ ] **Step 5: 删除旧页面文件并运行基线**

Run:

```powershell
npm run check
npm run lint
npm run test -- src/app/App.test.jsx
```

Expected: 三条命令退出码均为 `0`。

- [ ] **Step 6: 提交测试基线**

```powershell
git add frontend/operator-console/src frontend/operator-console/vite.config.js
git commit -m "Establish operator console test baseline"
```

### Task 3: 建立设计令牌、共享组件和四页路由

**Files:**
- Create: `frontend/operator-console/src/styles/tokens.css`
- Create: `frontend/operator-console/src/styles/reset.css`
- Create: `frontend/operator-console/src/styles/global.css`
- Create: `frontend/operator-console/src/components/primitives/Button.jsx`
- Create: `frontend/operator-console/src/components/primitives/Button.module.css`
- Create: `frontend/operator-console/src/components/primitives/Badge.jsx`
- Create: `frontend/operator-console/src/components/primitives/Card.jsx`
- Create: `frontend/operator-console/src/components/feedback/FeedbackState.jsx`
- Create: `frontend/operator-console/src/components/feedback/DisabledFeature.jsx`
- Create: `frontend/operator-console/src/components/layout/AppShell.jsx`
- Create: `frontend/operator-console/src/components/layout/AppShell.module.css`
- Create: `frontend/operator-console/src/components/layout/PageHeader.jsx`
- Create: `frontend/operator-console/src/app/router.jsx`
- Create: `frontend/operator-console/src/app/router.test.jsx`
- Modify: `frontend/operator-console/src/app/App.jsx`
- Modify: `frontend/operator-console/src/main.jsx`

- [ ] **Step 1: 写四页导航失败测试**

在 `router.test.jsx` 中使用 MemoryRouter，断言：

```jsx
expect(screen.getByRole("link", { name: "Agent 工作台" })).toBeInTheDocument();
expect(screen.getByRole("link", { name: "Skill 注册中心" })).toBeInTheDocument();
expect(screen.getByRole("link", { name: "SQL 工作台" })).toBeInTheDocument();
expect(screen.queryByRole("link", { name: "审计记录" })).not.toBeInTheDocument();
```

- [ ] **Step 2: 运行测试确认失败**

Run:

```powershell
npm run test -- src/app/router.test.jsx
```

Expected: FAIL，导航和路由尚未实现。

- [ ] **Step 3: 创建原型设计令牌**

在 `tokens.css` 定义原型中的浅灰页面背景、白色卡片、深色正文、红/蓝/绿/黄状态色、边框、阴影、圆角和间距。使用语义令牌，例如：

```css
:root {
  --color-canvas: #f3f5f7;
  --color-surface: #ffffff;
  --color-text: #2f3945;
  --color-muted: #758092;
  --color-accent: #d80b46;
  --color-info: #2584a9;
  --color-success: #1b8b60;
  --color-warning: #bd7b1d;
  --color-border: #dce2e8;
  --radius-card: 12px;
  --shadow-shell: 0 12px 30px rgba(31, 45, 61, 0.08);
}
```

- [ ] **Step 4: 实现共享组件和应用外壳**

`Button` 支持 `primary`、`secondary`、`danger`、`disabled`；`DisabledFeature` 必须显示禁用原因；`FeedbackState` 支持 loading、error、empty。所有组件使用 JSDoc 声明 props。

`AppShell` 只展示首轮三个受保护页面入口，并预留登录/退出操作区域。不要展示未实现页面入口。

- [ ] **Step 5: 实现路由占位页面**

在 `router.jsx` 配置：

```jsx
[
  { path: "/login", element: <div>登录页</div> },
  { path: "/agent", element: <AppShell><div>Agent 工作台</div></AppShell> },
  { path: "/skills", element: <AppShell><div>Skill 注册中心</div></AppShell> },
  { path: "/sql", element: <AppShell><div>SQL 工作台</div></AppShell> }
]
```

根路径暂时跳转 `/login`，Task 5 再接入会话判断。

- [ ] **Step 6: 运行共享组件与路由测试**

Run:

```powershell
npm run check
npm run lint
npm run test -- src/app/router.test.jsx
```

Expected: 全部 PASS。

- [ ] **Step 7: 提交应用外壳**

```powershell
git add frontend/operator-console/src/app frontend/operator-console/src/components frontend/operator-console/src/styles frontend/operator-console/src/main.jsx
git commit -m "Build prototype-driven console shell"
```

### Task 4: 建立统一 API 客户端和 Zod 契约边界

**Files:**
- Create: `frontend/operator-console/src/api/client.js`
- Create: `frontend/operator-console/src/api/auth-api.js`
- Create: `frontend/operator-console/src/api/agent-api.js`
- Create: `frontend/operator-console/src/api/skill-api.js`
- Create: `frontend/operator-console/src/api/sql-api.js`
- Create: `frontend/operator-console/src/schemas/auth-schemas.js`
- Create: `frontend/operator-console/src/schemas/agent-schemas.js`
- Create: `frontend/operator-console/src/schemas/skill-schemas.js`
- Create: `frontend/operator-console/src/schemas/sql-schemas.js`
- Create: `frontend/operator-console/src/api/client.test.js`
- Create: `frontend/operator-console/src/schemas/schemas.test.js`

- [ ] **Step 1: 写错误归一化和 Schema 失败测试**

测试必须断言：

```js
await expect(requestJson("/forbidden", { schema })).rejects.toMatchObject({
  status: 403,
  kind: "forbidden",
});

expect(() => browserSessionSchema.parse({ authenticated: "yes" })).toThrow();
expect(() => skillCatalogSchema.parse({ total: 1, skills: [] })).toThrow();
expect(() => sqlConnectionListSchema.parse([{ targetEnvironment: "production" }])).toThrow();
```

- [ ] **Step 2: 运行测试确认失败**

Run:

```powershell
npm run test -- src/api/client.test.js src/schemas/schemas.test.js
```

Expected: FAIL，API 客户端和 Schema 尚不存在。

- [ ] **Step 3: 实现统一 JSON 请求客户端**

`client.js` 提供：

```js
export class ApiError extends Error {
  /** @param {{status:number, kind:string, message:string}} input */
  constructor(input) {
    super(input.message);
    this.status = input.status;
    this.kind = input.kind;
  }
}

export async function requestJson(url, options) {
  const response = await fetch(url, {
    credentials: "include",
    ...options,
    headers: { Accept: "application/json", ...options?.headers },
  });
  if (!response.ok) {
    throw new ApiError({
      status: response.status,
      kind: response.status === 401 ? "unauthorized" : response.status === 403 ? "forbidden" : "request",
      message: `请求失败，HTTP ${response.status}`,
    });
  }
  return options.schema.parse(await response.json());
}
```

如果控制面已返回结构化错误正文，读取并保留服务端错误码与消息，但不得用展示文本推断授权状态。

- [ ] **Step 4: 实现 Zod Schema**

Schema 必须匹配现有真实响应：

- `browserSessionSchema`：`authenticated`、nullable `subject`/`username`、`roles`、`authenticationType`。
- `skillCatalogSchema` 和 `skillLookupSchema`：匹配 `RegisteredSkill`、`SkillDescriptor` 和发布元数据。
- `skillRoutingResponseSchema`：匹配候选 Skill、发布快照、score 和 matchedRules。
- `sqlConnectionListSchema`：只允许 `development`、`test` 和 `DB2_FOR_I`。
- `sqlValidationReportSchema`：匹配语句类型、验证等级、SQL hash、引用对象、风险、拒绝原因和未验证项。
- `semanticEventSchema`：保留后续真实事件展示能力，但首轮 Agent 页面不主动执行任务。

- [ ] **Step 5: 实现功能 API 模块**

映射真实接口：

```text
auth-api.js   -> GET /auth/session, GET /auth/login, POST /logout
skill-api.js  -> GET /internal/skills, GET /internal/skills/{skillId}
agent-api.js  -> POST /internal/routing/skills/search
sql-api.js    -> GET /internal/sql-workbench/connections
                 POST /internal/sql-workbench/queries/validate
```

Agent API 不得新增不存在的通用对话或执行请求。

- [ ] **Step 6: 运行 API 与 Schema 测试**

Run:

```powershell
npm run check
npm run lint
npm run test -- src/api/client.test.js src/schemas/schemas.test.js
```

Expected: 全部 PASS。

- [ ] **Step 7: 提交 API 边界**

```powershell
git add frontend/operator-console/src/api frontend/operator-console/src/schemas
git commit -m "Add validated console API boundaries"
```

### Task 5: 实现登录页和受保护路由

**Files:**
- Create: `frontend/operator-console/src/features/auth/use-session.js`
- Create: `frontend/operator-console/src/features/auth/LoginPage.jsx`
- Create: `frontend/operator-console/src/features/auth/LoginPage.module.css`
- Create: `frontend/operator-console/src/features/auth/ProtectedRoute.jsx`
- Create: `frontend/operator-console/src/features/auth/LoginPage.test.jsx`
- Modify: `frontend/operator-console/src/app/router.jsx`
- Modify: `frontend/operator-console/src/components/layout/AppShell.jsx`
- Modify: `frontend/operator-console/src/test/handlers.js`

- [ ] **Step 1: 写登录状态失败测试**

覆盖：

```jsx
test("shows the login action for an anonymous session", async () => {});
test("redirects an authenticated user from login to agent workspace", async () => {});
test("redirects an anonymous user from protected routes to login", async () => {});
test("shows a stable session error when the contract is invalid", async () => {});
```

MSW 默认处理 `/auth/session`，测试按需覆盖 anonymous、authenticated、HTTP 500 和无效契约响应。

- [ ] **Step 2: 运行登录测试确认失败**

Run:

```powershell
npm run test -- src/features/auth/LoginPage.test.jsx
```

Expected: FAIL，登录页面和受保护路由尚不存在。

- [ ] **Step 3: 实现会话查询和保护路由**

`use-session.js` 使用 TanStack Query：

```js
export function useSession() {
  return useQuery({
    queryKey: ["browser-session"],
    queryFn: fetchBrowserSession,
    staleTime: 30_000,
    retry: false,
  });
}
```

`ProtectedRoute` 只根据已认证会话决定页面导航；不得根据 roles 判断操作授权。

- [ ] **Step 4: 按原型实现登录页**

还原原型登录页的品牌区、登录卡片、P1 安全边界说明和按钮层级。登录按钮跳转现有 `/auth/login`。错误状态使用 `FeedbackState`，不暴露敏感响应内容。

- [ ] **Step 5: 接入退出和根路径跳转**

`AppShell` 显示会话用户名与退出入口；根路径按会话跳转 `/agent` 或 `/login`。

- [ ] **Step 6: 运行登录切片验证**

Run:

```powershell
npm run check
npm run lint
npm run test -- src/features/auth/LoginPage.test.jsx src/app/router.test.jsx
```

Expected: 全部 PASS。

- [ ] **Step 7: 提交登录页**

```powershell
git add frontend/operator-console/src/features/auth frontend/operator-console/src/app/router.jsx frontend/operator-console/src/components/layout/AppShell.jsx frontend/operator-console/src/test/handlers.js
git commit -m "Implement prototype login experience"
```

### Task 6: 实现 Agent 工作台的真实候选能力视图

**Files:**
- Create: `frontend/operator-console/src/features/agent-workspace/AgentWorkspacePage.jsx`
- Create: `frontend/operator-console/src/features/agent-workspace/AgentWorkspacePage.module.css`
- Create: `frontend/operator-console/src/features/agent-workspace/use-agent-candidates.js`
- Create: `frontend/operator-console/src/features/agent-workspace/AgentWorkspacePage.test.jsx`
- Modify: `frontend/operator-console/src/app/router.jsx`
- Modify: `frontend/operator-console/src/test/handlers.js`

- [ ] **Step 1: 写 Agent 工作台失败测试**

测试必须断言：

```jsx
expect(await screen.findByText("工作会话")).toBeInTheDocument();
expect(await screen.findByText("node-health-read")).toBeInTheDocument();
expect(screen.getByRole("button", { name: "发送任务" })).toBeDisabled();
expect(screen.getByText("通用 Agent 对话接口尚未开放")).toBeInTheDocument();
expect(screen.queryByText("模型内部推理")).not.toBeInTheDocument();
```

MSW 为 `/internal/routing/skills/search` 返回真实结构候选响应。

- [ ] **Step 2: 运行测试确认失败**

Run:

```powershell
npm run test -- src/features/agent-workspace/AgentWorkspacePage.test.jsx
```

Expected: FAIL，Agent 页面尚不存在。

- [ ] **Step 3: 实现真实候选查询**

`use-agent-candidates.js` 调用路由搜索接口，固定首轮安全筛选：

```js
{
  skillId: null,
  category: null,
  maxRiskLevel: "READ_ONLY",
  requiredParameters: [],
  requiredTags: [],
  requestContextTags: [],
  publicationStatusRequired: "VALIDATED"
}
```

此筛选只是请求条件，最终授权仍由服务端决定。

- [ ] **Step 4: 按原型实现 Agent 页面**

实现原型中的：

- 工作会话主区域。
- 选中任务详情。
- Skill 与事件侧栏。
- 会话上下文侧栏。

页面只展示真实候选 Skill 和 matchedRules。发送任务、执行计划和写操作按钮使用 `DisabledFeature` 明确禁用。

- [ ] **Step 5: 覆盖拒绝与空数据状态**

增加测试：

```jsx
test("shows service refusal without enabling task submission", async () => {});
test("shows an empty candidate state without mock skills", async () => {});
```

- [ ] **Step 6: 运行 Agent 页面验证**

Run:

```powershell
npm run check
npm run lint
npm run test -- src/features/agent-workspace/AgentWorkspacePage.test.jsx
```

Expected: 全部 PASS。

- [ ] **Step 7: 提交 Agent 工作台**

```powershell
git add frontend/operator-console/src/features/agent-workspace frontend/operator-console/src/app/router.jsx frontend/operator-console/src/test/handlers.js
git commit -m "Implement read-only agent workspace"
```

### Task 7: 实现 Skill 注册中心

**Files:**
- Create: `frontend/operator-console/src/components/data-display/DataTable.jsx`
- Create: `frontend/operator-console/src/components/data-display/DataTable.module.css`
- Create: `frontend/operator-console/src/components/data-display/StatusPill.jsx`
- Create: `frontend/operator-console/src/features/skill-registry/SkillRegistryPage.jsx`
- Create: `frontend/operator-console/src/features/skill-registry/SkillRegistryPage.module.css`
- Create: `frontend/operator-console/src/features/skill-registry/use-skills.js`
- Create: `frontend/operator-console/src/features/skill-registry/SkillRegistryPage.test.jsx`
- Modify: `frontend/operator-console/src/app/router.jsx`
- Modify: `frontend/operator-console/src/test/handlers.js`

- [ ] **Step 1: 写 Skill 列表失败测试**

测试必须覆盖：

```jsx
expect(await screen.findByText("node-health-read")).toBeInTheDocument();
expect(screen.getByText("READ_ONLY")).toBeInTheDocument();
expect(screen.getByText("platform-observability")).toBeInTheDocument();
expect(screen.getByRole("button", { name: "安装" })).toBeDisabled();
expect(screen.getByRole("button", { name: "升级" })).toBeDisabled();
expect(screen.getByRole("button", { name: "卸载" })).toBeDisabled();
```

- [ ] **Step 2: 运行测试确认失败**

Run:

```powershell
npm run test -- src/features/skill-registry/SkillRegistryPage.test.jsx
```

Expected: FAIL，Skill 页面尚不存在。

- [ ] **Step 3: 实现 Skill 查询和本地展示筛选**

`use-skills.js` 调用 `GET /internal/skills`。搜索、分类和风险筛选只在已获取的真实列表上进行展示过滤，不伪造服务端授权结果。

- [ ] **Step 4: 按原型实现注册中心**

实现：

- 搜索和分类/风险筛选条。
- Skill 表格。
- 选中 Skill 概要区。
- 发布状态、Owner、Executor、Interceptors 和输入输出摘要。

所有安装、升级、卸载和发布按钮保持禁用，并显示“服务端未提供受控变更接口”。

- [ ] **Step 5: 增加空数据、403 和契约失败测试**

```jsx
test("shows an empty registry without example skills", async () => {});
test("shows the server refusal for a forbidden registry request", async () => {});
test("blocks invalid skill catalog data", async () => {});
```

- [ ] **Step 6: 运行 Skill 页面验证**

Run:

```powershell
npm run check
npm run lint
npm run test -- src/features/skill-registry/SkillRegistryPage.test.jsx
```

Expected: 全部 PASS。

- [ ] **Step 7: 提交 Skill 注册中心**

```powershell
git add frontend/operator-console/src/components/data-display frontend/operator-console/src/features/skill-registry frontend/operator-console/src/app/router.jsx frontend/operator-console/src/test/handlers.js
git commit -m "Implement read-only skill registry"
```

### Task 8: 实现 SQL 工作台和懒加载 Monaco Editor

**Files:**
- Create: `frontend/operator-console/src/features/sql-workbench/SqlWorkbenchPage.jsx`
- Create: `frontend/operator-console/src/features/sql-workbench/SqlWorkbenchPage.module.css`
- Create: `frontend/operator-console/src/features/sql-workbench/SqlEditor.jsx`
- Create: `frontend/operator-console/src/features/sql-workbench/use-sql-workbench.js`
- Create: `frontend/operator-console/src/features/sql-workbench/SqlWorkbenchPage.test.jsx`
- Modify: `frontend/operator-console/src/app/router.jsx`
- Modify: `frontend/operator-console/src/test/handlers.js`

- [ ] **Step 1: 确认真实 SQL 接口文件仍存在**

Run:

```powershell
Test-Path backend/control-plane/bootstrap/src/main/java/com/company/opsagent/controlplane/bootstrap/api/SqlWorkbenchController.java
Test-Path backend/contracts/sqlworkbench/sql-query-request-v1.schema.json
```

Expected: 两项均为 `True`。若为 `False`，停止 SQL 页面实施并先解决接口事实源缺失。

- [ ] **Step 2: 写 SQL 页面失败测试**

测试使用轻量 mock 替代 Monaco 渲染器，但必须验证页面行为：

```jsx
expect(await screen.findByText("as400-development")).toBeInTheDocument();
expect(screen.queryByText("production")).not.toBeInTheDocument();
expect(screen.getByRole("button", { name: "校验只读执行" })).toBeEnabled();
expect(screen.getByRole("button", { name: "DML 预检" })).toBeEnabled();
expect(screen.getByRole("button", { name: "询问 AI" })).toBeDisabled();
```

- [ ] **Step 3: 运行测试确认失败**

Run:

```powershell
npm run test -- src/features/sql-workbench/SqlWorkbenchPage.test.jsx
```

Expected: FAIL，SQL 页面尚不存在。

- [ ] **Step 4: 实现 SQL 查询 hooks**

`use-sql-workbench.js` 提供：

- `useSqlConnections()`。
- `useValidateSqlQuery()`。
- 客户端只构造版本化请求，不自行判断 SQL 是否安全。

请求示例：

```js
{
  contractVersion: "1.0",
  connectionId,
  targetEnvironment,
  schema,
  action,
  sql,
  parameters: [],
  limits: { maxRows: 500, maxBytes: 5000000, timeoutSeconds: 30 },
  idempotencyKey: `sql:${action}:${crypto.randomUUID()}`
}
```

- [ ] **Step 5: 按原型实现 SQL 工作台**

实现：

- 顶部连接/环境/模式工具条。
- 左侧数据库对象区域，只展示服务端连接和 allowedSchemas。
- 中间 SQL 编辑器、操作工具栏和报告结果区。
- 右侧 AI SQL 助手禁用区域。
- 风险、拒绝原因和未验证项的服务端结果展示。

Monaco 只在 SQL 路由中通过 `lazy` 或动态 import 加载。不要实现执行脚本、事务、Commit、Rollback 或生产连接入口。

- [ ] **Step 6: 增加 SQL 安全边界测试**

覆盖：

```jsx
test("does not render a production connection returned by an invalid contract", async () => {});
test("renders server rejection reasons without executing SQL", async () => {});
test("keeps the AI assistant disabled", async () => {});
```

无效 production 连接应触发 Zod 契约错误，而不是静默过滤并继续使用。

- [ ] **Step 7: 运行 SQL 页面验证**

Run:

```powershell
npm run check
npm run lint
npm run test -- src/features/sql-workbench/SqlWorkbenchPage.test.jsx
```

Expected: 全部 PASS。

- [ ] **Step 8: 提交 SQL 工作台**

```powershell
git add frontend/operator-console/src/features/sql-workbench frontend/operator-console/src/app/router.jsx frontend/operator-console/src/test/handlers.js
git commit -m "Implement validated SQL workbench"
```

### Task 9: 增加浏览器流程和桌面视觉验收

**Files:**
- Create: `frontend/operator-console/playwright.config.js`
- Create: `frontend/operator-console/tests/e2e/app-navigation.spec.js`
- Create: `frontend/operator-console/tests/e2e/sql-workbench.spec.js`
- Create: `frontend/operator-console/tests/e2e/fixtures/`
- Modify: `frontend/operator-console/package.json`

- [ ] **Step 1: 写失败的导航端到端测试**

`app-navigation.spec.js` 必须验证：

```js
await page.goto("/login");
await expect(page.getByRole("heading", { name: "操作员登录" })).toBeVisible();
await page.goto("/agent");
await expect(page.getByRole("heading", { name: "Agent 工作区" })).toBeVisible();
await page.getByRole("link", { name: "Skill 注册中心" }).click();
await expect(page.getByRole("heading", { name: "Skill 注册中心" })).toBeVisible();
```

使用 Playwright route fulfillment 提供真实契约结构的测试响应，不依赖生产数据。

- [ ] **Step 2: 写 SQL 安全边界端到端测试**

验证：

- SQL 页面只显示 development/test 连接。
- 只读校验请求发送到控制面路径。
- AI 助手禁用。
- 页面不存在执行脚本、Commit、Rollback 和 production 入口。

- [ ] **Step 3: 运行端到端测试确认失败**

Run:

```powershell
npx playwright install chromium
npm run test:e2e
```

Expected: FAIL，原因是 Playwright 尚未配置 `baseURL` 和 Vite `webServer`，相对路径无法打开。

- [ ] **Step 4: 配置桌面视口项目**

`playwright.config.js` 定义三个 Chromium project：

```js
[
  { name: "desktop-1280", use: { viewport: { width: 1280, height: 960 } } },
  { name: "desktop-1440", use: { viewport: { width: 1440, height: 1080 } } },
  { name: "desktop-1920", use: { viewport: { width: 1920, height: 1080 } } }
]
```

同时配置：

```js
{
  use: { baseURL: "http://127.0.0.1:4173" },
  webServer: {
    command: "npm run dev -- --host 127.0.0.1 --port 4173",
    url: "http://127.0.0.1:4173",
    reuseExistingServer: true
  }
}
```

- [ ] **Step 5: 对照原型逐页修复视觉差异**

对照：

- `figma-prototype/ops-agent-aia-prototype.html`
- `figma-prototype/ops-agent-aia-registry.png`
- `figma-prototype/preview-sql-console-bottom.png`

检查导航、标题、卡片层级、间距、边框、圆角、字体层级、禁用状态和内容裁切。登录页与 Agent 页面从原型 HTML 对应屏幕提取视觉事实。

- [ ] **Step 6: 运行完整前端验证**

Run:

```powershell
npm run check
npm run lint
npm run test
npm run test:e2e
npm run build
```

Expected: 全部命令退出码为 `0`。

- [ ] **Step 7: 提交浏览器验收**

```powershell
git add frontend/operator-console/playwright.config.js frontend/operator-console/tests frontend/operator-console/package.json frontend/operator-console/package-lock.json frontend/operator-console/src
git commit -m "Add operator console browser acceptance"
```

### Task 10: 更新 CI、运行手册和规划事实源

**Files:**
- Modify: `.github/workflows/ci.yml`
- Modify: `frontend/operator-console/README.md`
- Modify: `docs/planning/project-plan.md`
- Modify: `docs/planning/design-traceability.md`
- Modify: `docs/architecture/module-map.md`
- Modify: `docs/standards/testing-and-evaluation-baseline.md`

- [ ] **Step 1: 扩展 CI 前端门禁**

将 `frontend-build` job 拆分或扩展为：

```yaml
- run: npm ci
- run: npm run check
- run: npm run lint
- run: npm run test
- run: npm run build
```

Playwright 浏览器测试若加入 CI，必须安装 Chromium，并保存失败截图/报告；若 CI 运行成本暂不接受，则在事实源中明确其本地验收门禁和后续接入条件，不能静默跳过。

- [ ] **Step 2: 更新操作台 README**

记录：

- 四个首轮页面。
- JavaScript/JSDoc/`checkJs` 工具链。
- 本地安装、开发、测试、端到端测试和构建命令。
- 真实接口优先和缺失能力禁用原则。
- P1 禁止项。

- [ ] **Step 3: 更新规划和追溯文档**

在项目计划、设计追溯和模块地图中记录：

- M09 首轮重写范围。
- 已接入真实接口。
- 未实现页面与禁用能力。
- JavaScript 工具链决策变化。
- 验收证据和后续工作。

- [ ] **Step 4: 运行仓库级验证**

Run:

```powershell
Set-Location frontend/operator-console
npm ci
npm run check
npm run lint
npm run test
npm run test:e2e
npm run build
Set-Location ../..
./tools/ci/check-repository.ps1
./tools/ci/check-contracts.ps1
./tools/ci/scan-secrets.ps1
Set-Location backend
./mvnw.cmd -f ./pom.xml -B -ntp verify
```

Expected:

- 所有前端门禁退出码为 `0`。
- 仓库规范、契约和密钥扫描退出码为 `0`。
- 后端 Maven verify 退出码为 `0`，确认前端重写未破坏现有接口测试。

- [ ] **Step 5: 检查最终差异和禁止项**

Run:

```powershell
git diff --check
rg -n "production|Commit|Rollback|执行脚本|任意脚本|mock success" frontend/operator-console/src
rg -n "fetch\\(" frontend/operator-console/src/features frontend/operator-console/src/components
```

Expected:

- `git diff --check` 无输出。
- 禁止项仅出现在明确说明或断言不存在的测试中。
- 页面和共享组件中没有直接 `fetch`，请求只存在于 `src/api`。

- [ ] **Step 6: 提交 CI 与文档**

```powershell
git add .github/workflows/ci.yml frontend/operator-console/README.md docs/planning/project-plan.md docs/planning/design-traceability.md docs/architecture/module-map.md docs/standards/testing-and-evaluation-baseline.md
git commit -m "Document and enforce console rewrite gates"
```

## 最终完成检查

实施者在声明完成前必须重新核对：

- [ ] 四个页面均使用真实接口或明确禁用缺失能力。
- [ ] 未实现页面没有虚假入口。
- [ ] 所有外部数据经过 Zod 校验。
- [ ] 页面和共享组件不直接调用 `fetch`。
- [ ] 浏览器不做授权决策。
- [ ] SQL 工作台不存在生产连接、DML 执行、事务提交或回滚入口。
- [ ] Agent 工作台不展示模型内部推理且不模拟任务执行成功。
- [ ] Skill 注册中心不模拟安装、升级、卸载或发布成功。
- [ ] Mock Service Worker 只从测试文件导入。
- [ ] `checkJs`、ESLint、组件测试、Playwright、生产构建、仓库检查、契约检查、密钥扫描和 Maven verify 均有新鲜通过证据。
