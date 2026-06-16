# M09 基于原型的操作台首轮重写任务交接

- 文档日期：2026-06-14
- 任务状态：进行中，已主动暂停实现并形成交接
- 当前分支：`codex/operator-console-rewrite`
- 当前 HEAD：`c54d2a2 Build prototype-driven console shell`
- 相关模块：M01、M03、M04、M09、M11
- 当前阶段：P1 只读诊断 MVP

## 1. 文档用途

本文档用于在下次会话或任务重启时恢复“基于原型重写操作台首轮页面”的准确上下文。恢复实施前必须先阅读本文档、已批准设计和实施计划，并重新检查工作树，避免覆盖或误提交其他并行任务的变更。

本任务尚未完成。当前已完成工具链迁移、旧页面移除、测试基线和应用外壳；统一 API 客户端与 Zod Schema 边界正在实施中，但尚未评审和提交；四个目标页面尚未完成。

## 2. 已确认的产品与实施决策

用户已经确认以下决策，恢复任务时无需再次询问：

1. 删除已有前端页面实现，基于原型重新编写。
2. 开发语言使用 JavaScript，而非 TypeScript 业务源码。
3. 前端采用 React、JSX、JSDoc、TypeScript `checkJs`。
4. 首轮仅实现登录页、Agent 工作台、Skill 注册中心和 SQL 工作台。
5. 真实接口优先；缺失能力明确显示禁用状态；产品运行时禁止使用 Mock 数据伪装成功。
6. 登录和 SQL 对接现有真实接口；Agent、Skill 根据现有接口实现，缺失操作保持禁用。
7. 桌面端优先，重点支持 `1280px` 至 `1920px`。
8. 采用实施计划中的方案 1：按功能切片逐页实施。
9. 后续实施决策由执行者自行决定，无需再次询问，直到目标完成。

## 3. 必须遵循的事实源

恢复任务后必须先阅读并遵循：

1. `C:\Users\Lenovo\Documents\ops-agent\AGENTS.md`
2. `C:\Users\Lenovo\Documents\ops-agent\docs\architecture\module-map.md`
3. `C:\Users\Lenovo\Documents\ops-agent\docs\planning\project-plan.md`
4. `C:\Users\Lenovo\Documents\ops-agent\docs\planning\design-traceability.md`
5. `docs/superpowers/specs/2026-06-13-m09-prototype-driven-operator-console-rewrite-design.md`
6. `docs/superpowers/plans/2026-06-13-m09-prototype-driven-operator-console-rewrite.md`
7. `docs/adr/0003-operator-console-toolchain.md`

视觉事实源：

- 本机原型：`D:\poc-ops-agent\figma-prototype\ops-agent-aia-prototype.html`
- 仓库原型：`figma-prototype/ops-agent-aia-prototype.html`
- 原型截图：`figma-prototype/` 下相关 PNG 文件

注意：当前浏览器自动化不允许直接控制 `file://` 页面。此前通过读取本地原型文件和截图确认视觉结构。受保护页面应采用新版原型的固定左侧导航。

## 4. 安全与范围边界

恢复实施时不得突破以下边界：

- 当前 P1 仅允许只读诊断，不实现生产写执行或任意脚本执行。
- 浏览器不做授权决策，不根据展示文本或角色字段推断操作权限。
- 页面不得直接访问 Worker、数据库或目标系统。
- Agent 页面不得展示模型内部推理，不得伪造任务发送或执行成功。
- Skill 页面不得伪造安装、升级、卸载或发布成功。
- SQL 页面不得显示或调用生产连接，不提供 DML 执行、Commit、Rollback 或交互式事务。
- AI SQL 助手在通过模型评测门禁前必须保持禁用。
- Mock Service Worker 仅用于自动化测试，不得进入生产运行路径。
- 页面与共享组件不得直接调用 `fetch`，请求统一放在 `src/api`。
- 所有外部响应必须经过 Zod Schema 校验后才能进入页面。

## 5. 技术栈

当前已采用并写入工程配置：

- React 19
- JavaScript、JSX、JSDoc、TypeScript `checkJs`
- Vite 8
- React Router
- TanStack Query
- Zod
- Lucide React
- CSS Modules 页面级原型还原
- CSS Modules 与 CSS Variables
- Vitest、React Testing Library、Mock Service Worker
- Playwright

用户已明确批准升级到 Vite 8，以处理 Vite 6 依赖链中的高危安全问题。Task 1 至 Task 3 阶段的 `npm audit` 结果为零漏洞。恢复时仍需重新运行审计。

## 6. 已完成内容

### 6.1 设计与实施计划

已完成并提交：

- `fe69e17 Document prototype-driven console rewrite`
  - 形成已批准设计文档。
- `2f2c7a2 Plan prototype-driven console rewrite`
  - 形成 Task 1 至 Task 10 的详细实施计划。

### 6.2 Task 1：JavaScript 工具链迁移

状态：已完成并提交。

提交：

- `0684077 Adopt JavaScript operator console toolchain`

完成内容：

- 更新全局工程契约和 ADR 0003，记录 JavaScript/JSX/JSDoc/`checkJs` 决策。
- 将 Vite 配置迁移为 JavaScript。
- 删除旧 TypeScript 配置文件。
- 配置 ESLint、`jsconfig.json`、Vitest 和前端依赖。
- 升级到 Vite 8.0.16 和 `@vitejs/plugin-react` 6.0.2。
- 使用 `dompurify` 3.4.0 override 消除已知安全问题。

### 6.3 Task 2：测试基线与旧页面移除

状态：已完成并提交。

提交：

- `4d37f80 Establish operator console test baseline`

完成内容：

- 删除旧页面及旧 API 实现：
  - `src/App.tsx`
  - `src/api.ts`
  - `src/main.tsx`
  - `src/styles.css`
  - `src/types.ts`
- 新建 JavaScript 应用入口、Provider 和最小 App。
- 新建 Vitest、React Testing Library、MSW 测试基础设施。
- 保留真实接口路径语义，不保留旧页面结构。

### 6.4 Task 3：应用外壳、设计令牌、共享组件与路由

状态：已完成并提交。

提交：

- `c54d2a2 Build prototype-driven console shell`

完成内容：

- 建立设计令牌、全局样式和重置样式。
- 建立固定左侧导航应用外壳，匹配新版原型方向。
- 仅展示 Agent 工作台、Skill 注册中心和 SQL 工作台三个受保护页面入口。
- 建立 `/login`、`/agent`、`/skills`、`/sql` 路由占位页。
- 根路径当前暂时跳转 `/login`，待登录页任务接入真实会话后调整。
- 建立 Button、Badge、Card、PageHeader、FeedbackState、DisabledFeature 等共享组件。
- 补充共享组件和路由测试。

2026-06-14 Git 提交复核补充：

- `main` / `origin/main` 已包含 `ab57a00 登录页转react`，新增 `frontend/operator-console/src/features/auth/LoginPage.jsx` 和 `LoginPage.module.css`，并把 `/login` 从 `LoginPlaceholder` 切换为 `LoginPage`。
- 当前 `codex/operator-console-rewrite` 工作分支仍停在 `02b5ef5`，尚未同步 `ab57a00`，因此本分支工作树里仍会看到登录占位页。
- `ab57a00` 已完成原型化登录视觉、SSO 登录按钮和对应路由测试；按钮通过 `redirectToLogin()` 跳转到 `/auth/login`。
- `auth-api.js` 仍只封装 `/auth/session`、`/auth/login` 跳转地址和 `POST /logout`，尚未封装内建身份模式需要的 `POST /auth/login` 和 `POST /auth/password`。
- `AppShell` 的会话区域仍是静态文案，没有读取真实会话主体，也没有退出入口。
- `/agent`、`/skills` 和 `/sql` 仍不是会话保护路由，匿名访问不会被 React 层拦截到登录页。

### 6.5 主分支同步处理

实施期间用户提示新代码已同步且可能合入 `main`。已检查并将当前分支从 `0684077` 快进同步至 `f74f795`，随后继续提交 Task 2 和 Task 3。同步时未发现前端重写冲突。

恢复任务时仍必须重新检查 `main` 与当前分支差异，因为后续可能继续有新代码同步。

## 7. 当前正在进行但未完成的内容

### 7.1 Task 4：统一 API 客户端与 Zod 契约边界

状态：实现文件已生成，静态检查和现有测试通过，但尚未完成评审、构建验证和提交。

为了形成本文档，仍在运行的 Task 4 子任务已于 2026-06-14 主动终止，避免工作树继续变化。

当前未跟踪文件：

```text
frontend/operator-console/src/api/agent-api.js
frontend/operator-console/src/api/auth-api.js
frontend/operator-console/src/api/client.js
frontend/operator-console/src/api/client.test.js
frontend/operator-console/src/api/skill-api.js
frontend/operator-console/src/api/sql-api.js
frontend/operator-console/src/schemas/agent-schemas.js
frontend/operator-console/src/schemas/auth-schemas.js
frontend/operator-console/src/schemas/schemas.test.js
frontend/operator-console/src/schemas/skill-schemas.js
frontend/operator-console/src/schemas/sql-schemas.js
```

已实现方向：

- 统一 JSON 请求客户端。
- `401`、`403`、普通请求错误、网络错误和 Schema 错误归一化。
- 身份会话、Skill 目录、Skill 路由搜索、SQL 连接与 SQL 校验响应的 Zod Schema。
- 映射真实接口模块。

已映射或计划映射的真实接口：

```text
GET  /auth/session
GET  /auth/login
POST /logout
GET  /internal/skills
GET  /internal/skills/{skillId}
POST /internal/routing/skills/search
GET  /internal/sql-workbench/connections
POST /internal/sql-workbench/queries/validate
```

明确不存在且不得自行增加的接口：

- 通用 Agent 聊天接口。
- Agent 任务发送或执行接口。
- Skill 安装、升级、卸载或发布接口。
- SQL 生产执行、DML 执行、Commit 或 Rollback 接口。

Task 4 恢复后必须完成：

1. 逐文件检查实现是否准确匹配当前后端契约。
2. 进行 Task 4 规格评审和代码质量评审。
3. 修复评审问题。
4. 运行完整前端构建和依赖审计。
5. 仅暂存 `frontend/operator-console/src/api` 和 `frontend/operator-console/src/schemas`。
6. 提交为 `Add validated console API boundaries`。

## 8. 尚未开始的内容

### Task 5：登录页和受保护路由

源码复核结论：`ab57a00` 后登录页视觉 React 化约完成 65%，登录相关前端闭环约完成 35%。已具备 React 登录页、会话查询 Schema、OIDC 登录跳转地址和视觉回归测试，但尚未形成完整会话读取、匿名保护、内建身份登录、改密和退出闭环。

已由 `ab57a00` 部分完成：

- 实现原型登录页。
- 将 `/login` 路由接入 `LoginPage`。
- 登录按钮接入 `/auth/login` 跳转入口。
- 补充登录页视觉与安全边界测试。

需要：

- 在当前工作分支同步 `main` 上的 `ab57a00`。
- 用 `/auth/session` 驱动已登录、未登录和加载状态。
- 对接内建身份模式的 `POST /auth/login`、`POST /auth/password` 和后端实际登出入口。
- 实现匿名访问受保护页面时跳转登录页。
- 登录成功后跳转 `/agent`。
- 在 AppShell 显示会话主体和退出入口。

### Task 6：Agent 工作台

2026-06-14 已开始并完成首轮 Agent 工作台原型转 React：

- 新增 `frontend/operator-console/src/features/agent-workspace/AgentWorkspacePage.jsx`、`AgentWorkspacePage.module.css`、`use-agent-candidates.js` 和页面测试。
- `/agent` 已从 `ProtectedPlaceholder` 切换为 `AppShell + AgentWorkspacePage`。
- 页面布局参考 `figma-prototype/ops-agent-aia-prototype.html` 的 Agent 工作区片段，已按原型还原顶部胶囊栏、会话工具栏、工作会话主窗、双 workflow 卡片、输入区、选中任务详情、Skill 与事件、会话上下文侧栏。
- 已对接 `POST /internal/routing/skills/search`，候选 Skill、评分和匹配规则来自服务端响应，并统一经过 `src/api/agent-api.js` 与 Zod Schema。
- 首轮固定请求 `READ_ONLY` 与 `VALIDATED` 候选能力；该筛选只是请求条件，授权结果仍以服务端策略为准。
- 通用 Agent 对话、任务发送和执行接口尚未开放，发送按钮保持禁用并显示原因，不模拟任务发送或执行成功。
- 页面不展示模型内部推理，只展示可审计计划摘要。
- 新增测试覆盖候选 Skill 成功渲染、服务端 `403` 拒绝、空候选状态、发送按钮禁用和内部推理文案缺失。
- 已使用本机 Chrome + Playwright 截取 `1440x1080` 对比截图：`.artifacts/agent-reference-screen.png` 和 `.artifacts/agent-react-screen.png`。当前 React 页高度为 1080，无横向溢出，核心工作区落入首屏。

仍需后续完成：

- 接入真实浏览器会话后，将静态会话提示替换为 `/auth/session` 返回的主体信息。
- 在后端开放版本化任务接口、工作流和审计链路后，再启用任务提交。
- 继续在 Skill 注册中心完成后执行整套页面的浏览器截图验收，并补齐正式 Playwright E2E。

### Task 7：Skill 注册中心

尚未开始。需要：

- 使用真实 Skill 目录接口。
- 实现真实列表、搜索、筛选、详情与状态展示。
- 安装、升级、卸载、发布操作保持禁用并显示原因。
- 补充空数据、403 和无效契约测试。

### Task 8：SQL 工作台

2026-06-14 已开始并完成 SQL 原型转 React，并根据用户反馈完成视觉返工：

- 新增 `frontend/operator-console/src/features/sql-workbench/SqlWorkbenchPage.jsx`、`SqlWorkbenchPage.module.css`、`use-sql-workbench.js` 和页面测试。
- `/sql` 已从 `ProtectedPlaceholder` 切换为独立 `SqlWorkbenchPage`，不再套用通用 `AppShell`，以匹配原型固定 screen 坐标。
- 页面布局参考 `D:\poc-ops-agent\figma-prototype\ops-agent-aia-prototype.html` 的 `id="sql-workbench-screen"` 片段，落地左侧胶囊导航、顶部 EA 胶囊、连接工具条、数据库对象浏览、多 SQL 文件标签、查询编辑器视觉区、服务端报告、结果区和右侧 AI SQL 助手禁用区。
- 已对接 `GET /internal/sql-workbench/connections` 和 `POST /internal/sql-workbench/queries/validate`，请求仍统一经过 `src/api/sql-api.js` 与 Zod Schema。
- SQL 编辑区采用原型同结构代码展示，以保证像素还原；可触发动作仍只映射到服务端只读校验或 DML 预检契约。
- P1 边界保持：不展示生产连接，不提供真实 DML 执行、交互事务、Commit、Rollback 或任意脚本执行；AI SQL 助手按钮保持禁用。
- 新增测试覆盖连接目录渲染、版本化 SQL 校验请求、服务端拒绝报告、生产连接契约拒绝和 AI 助手禁用。
- 视觉 QA 文档为 `design-qa.md`，参考截图为 `frontend/operator-console/.artifacts/sql-reference-screen.png`，React 截图为 `frontend/operator-console/.artifacts/sql-react-screen.png`。

仍需后续完成：

- 使用真实控制面和 Worker 联调 SQL 连接目录与校验报告。
- 与真实控制面联调后重新截取浏览器截图，确认接口数据不会破坏原型布局。
- 在 Task 9 中补 Playwright 桌面端验收。

### Task 9：浏览器流程和桌面视觉验收

尚未开始。需要：

- 配置 Playwright。
- 覆盖 `1280px`、`1440px`、`1920px`。
- 对四个页面进行实际交互和视觉对比。
- 检查导航、层级、间距、裁切、禁用状态和关键操作可达性。

### Task 10：CI、README 与规划事实源更新

尚未开始。需要：

- 更新前端 CI 门禁。
- 更新操作台 README。
- 更新模块地图、项目计划、设计追溯和测试基线。
- 记录已完成、未完成、发布与回滚影响。

### 最终评审与完成检查

尚未开始。需要完成全部前端、仓库、契约、安全和 Maven 验证后，才能声明首轮重写完成。

## 9. 最近一次验证证据

在 `frontend/operator-console` 下，Task 4 未提交文件存在时，最近一次运行结果：

```text
npm run check  -> PASS
npm run lint   -> PASS
npm run test   -> PASS，5 个测试文件，28 个测试
```

2026-06-14 SQL 工作台 React 转换后新增验证：

```text
npm run test -- src/features/sql-workbench/SqlWorkbenchPage.test.jsx
  -> PASS，1 个测试文件，4 个测试
npm run check
  -> PASS
npm run lint
  -> PASS
npm run test -- src/app/router.test.jsx src/features/sql-workbench/SqlWorkbenchPage.test.jsx
  -> PASS，2 个测试文件，12 个测试
npm run test
  -> PASS，7 个测试文件，40 个测试
npm run build
  -> PASS，生成 dist/index.html、index CSS 和 index JS chunk
Chrome headless browser check at http://127.0.0.1:5174/sql
  -> PASS，连接数据可见，DML 预检可触发，未出现 Commit/Rollback，参考截图：frontend/operator-console/.artifacts/sql-reference-screen.png，React 截图：frontend/operator-console/.artifacts/sql-react-screen.png
git diff --check
  -> PASS
```

浏览器检查期间使用 Playwright 拦截 `/internal/sql-workbench/connections` 和 `/internal/sql-workbench/queries/validate`，未替换或关闭本机 `8080` 上已有的其他 mock 服务。Vite 开发服务器仍在 `http://127.0.0.1:5174/` 运行；真实联调需要启动控制面 `http://127.0.0.1:8080`。

已知非阻塞警告：

- 当前本机 Node.js 为 v25.2.1。
- 测试期间会重复出现实验性全局 `localStorage` 的 `--localstorage-file` 无效路径警告。
- 项目 CI 预期使用 Node.js 22，因此目前判断为本机 Node 25 特有警告。

当前没有新鲜验证证据：

- Task 4 文件存在后的 `npm run build`。
- Task 4 文件存在后的 `npm audit --audit-level=high`。
- Playwright。
- 仓库检查、契约检查、密钥扫描。
- 后端 Maven `verify`。

不得把以上未运行项描述为通过。

## 10. 当前工作树中的并行变更

当前工作树不是干净状态。除 Task 4 API/Zod 文件外，还存在大量后端、SQL 工作台、规划文档和 `frontend/operator-console/README.md` 变更。这些变更来自用户或并行同步，不属于当前前端重写 Task 4 的所有权范围。

恢复任务时：

- 不得回退、覆盖、删除这些并行变更。
- 不得把这些并行变更纳入前端 Task 4 提交。
- 如后续 Task 8 需要使用 SQL 接口，应将其作为现有事实源读取，而不是接管或重写后端变更。
- 如后续 Task 10 需要修改已被并行任务改动的文档，必须先阅读并在现有内容上增量编辑。

当前已修改但不属于 Task 4 的关键区域：

```text
backend/contracts/
backend/control-plane/
backend/execution-worker/
backend/pom.xml
docs/architecture/module-map.md
docs/planning/design-traceability.md
docs/planning/project-plan.md
frontend/operator-console/README.md
```

当前未跟踪且不属于 Task 4 的关键区域：

```text
backend/contracts/sqlworkbench/
backend/contracts/src/main/java/com/company/opsagent/contracts/sqlworkbench/
backend/control-plane/modules/sqlworkbench/
backend/control-plane/bootstrap/.../SqlWorkbenchController.java
backend/control-plane/bootstrap/.../SqlWorkbenchConfiguration.java
backend/execution-worker/ 下多个 SQL 工作台实现与测试文件
docs/adr/0006-p1-sql-workbench-boundary.md
docs/adr/0007-sql-workbench-controlled-development-crud.md
docs/architecture/sql-workbench-product-design.md
docs/runbooks/p1-sql-workbench.md
```

每次提交前必须使用明确路径执行 `git add`，禁止使用无范围的 `git add .`。

## 11. 推荐恢复步骤

下次重启任务时按以下顺序执行：

1. 阅读第 3 节列出的全部事实源、设计文档、实施计划和本文档。
2. 确认当前分支和工作树：

```powershell
git branch --show-current
git status --short
git log --oneline -10
```

3. 检查 `main` 是否又有新同步代码，并评估是否需要安全合并；不得覆盖当前并行变更。
4. 检查 Task 4 的未跟踪 API 与 Schema 文件是否仍存在，逐文件核对后端真实契约。
5. 在 `frontend/operator-console` 运行：

```powershell
npm run check
npm run lint
npm run test
npm run build
npm audit --audit-level=high
```

6. 在仓库根目录运行：

```powershell
git diff --check
```

7. 完成 Task 4 规格评审和质量评审，修复问题后仅提交：

```powershell
git add frontend/operator-console/src/api frontend/operator-console/src/schemas
git commit -m "Add validated console API boundaries"
```

8. 按实施计划继续执行 Task 5 至 Task 10，每个任务独立测试、评审和提交。
9. 页面完成后使用本地 Vite 地址进行浏览器验收；不要尝试用自动化直接控制 `file://` 原型。
10. 最终完成前重新运行完整前端门禁、Playwright、仓库检查、契约检查、密钥扫描和 Maven `verify`。

## 12. 完成标准

只有同时满足以下条件才能声明本任务完成：

- 四个目标页面均已实现并可通过路由访问。
- 登录和 SQL 页面已接入真实接口。
- Agent 和 Skill 页面使用现有真实接口，所有缺失操作明确禁用。
- 产品运行时没有 Mock 成功数据。
- 所有外部数据经过 Zod 校验。
- 页面和共享组件不直接调用 `fetch`。
- 浏览器不做授权决策，不绕过控制面。
- 不存在生产写执行、任意脚本执行、生产 SQL、DML 执行、Commit、Rollback 或审批绕过入口。
- `checkJs`、ESLint、Vitest、Playwright、生产构建和依赖审计通过。
- 仓库检查、契约检查、密钥扫描和 Maven `verify` 通过。
- 相关 README、规划事实源和验证证据已更新。

## 13. 当前恢复起点

恢复时从 Task 4 继续，不要重复 Task 1 至 Task 3，也不要直接跳到页面实施。首先完成并评审当前未提交的 API/Zod 边界，然后按 Task 5、Task 6、Task 7、Task 8、Task 9、Task 10 顺序推进。
