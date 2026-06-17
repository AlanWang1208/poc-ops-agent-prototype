# 操作台

操作台是 `M09` 的前端交付单元。

## 主要职责

- 展示强类型语义事件流。
- 消费后端提供的浏览器会话状态，而不是在前端做授权决策。
- 触发只读诊断请求，并在事件流中断时尝试恢复。
- 明确呈现登录状态、权限不足和执行失败等服务端结果。
- 通过 Zod 校验所有 API 和事件边界响应，页面只渲染通过契约的数据。

## 首轮页面

- 登录页：读取 `/auth/session`，匿名用户展示控制面登录入口，已认证用户进入操作台。
- Agent 工作台：读取 `/internal/routing/skills/search`，只展示 P1 只读、已验证发布的候选 Skill；任务发送入口保持禁用。
- Skill 注册中心：读取 `/internal/skills`，支持真实目录搜索、分类筛选、风险筛选和详情查看；安装、升级、卸载保持禁用。
- SQL 工作台：读取 `/internal/sql-workbench/connections` 和 `/internal/sql-workbench/queries/validate`，只提供开发/测试连接的 SQL 校验和 DML 预检报告。

## 技术栈

- JavaScript / JSX。
- JSDoc 契约注释。
- TypeScript `checkJs` 严格静态检查。
- React、React Router、TanStack Query、Zod。
- Vitest 覆盖组件、Hook、Schema 和 API 边界。
- Playwright 覆盖 `1280px`、`1440px`、`1920px` 桌面浏览器验收。

## 禁止事项

- 不在浏览器中自行做授权决策。
- 不直接调用目标系统。
- 不绕过控制面的策略、审计、幂等和恢复语义。
- 不把模型文本或展示文案当作安全状态事实源。
- 不提供生产写执行、任意脚本执行、生产 SQL 连接、DML 执行、Commit 或 Rollback。
- 不使用 Mock 成功数据伪装真实服务端能力；缺失接口必须显示禁用或错误状态。

## 登录页源码状态

以下状态基于 `main` / `origin/main` 上的 `ab57a00 登录页转react`。如果当前开发分支尚未同步该提交，工作树里仍可能看到旧的登录占位页。

- React 应用外壳、`/login`、`/agent`、`/skills` 和 `/sql` 路由已经建立。
- `/login` 已接入 React 登录页视觉，包含原型化首屏、安全能力展示和“使用企业 SSO 登录”按钮。
- 前端认证 API 当前只封装 `/auth/session`、`/auth/login` 跳转地址和 `POST /logout`；登录页按钮通过 `/auth/login` 进入后端 OIDC 登录入口。
- 内建身份模式需要的 `POST /auth/login`、`POST /auth/password` 尚未在前端封装；后端内建登出入口当前是 `GET /auth/logout`，前端退出路径仍需统一。
- 受保护页面当前不会读取浏览器会话，也不会在匿名访问时跳转登录页。
- `AppShell` 会话区域仍是静态文案，尚未展示真实主体、角色或退出入口。

## Agent 工作台

- `/agent` 已从占位页切换为 React Agent 工作区页面，布局参考 `figma-prototype/ops-agent-aia-prototype.html` 的 Agent 工作区片段。
- 页面已还原原型中的顶部胶囊栏、会话工具栏、工作会话主窗、双 workflow 卡片、任务输入区、选中任务详情、Skill 与事件、会话上下文侧栏。
- 候选 Skill 只通过 `src/api/agent-api.js` 调用控制面 `POST /internal/routing/skills/search`，页面和组件不直接 `fetch`。
- 首轮固定请求 `READ_ONLY`、`VALIDATED` 候选能力；授权结论仍以服务端策略返回为准，前端不根据展示文本判断权限。
- 通用 Agent 对话、任务发送和执行接口尚未开放，发送按钮保持禁用并显示原因；页面不模拟任务执行成功。
- 页面不展示模型内部推理，只展示可审计计划摘要和服务端候选能力。
- 自动化测试覆盖候选 Skill 成功渲染、服务端 `403` 拒绝、空候选状态、发送按钮禁用和内部推理文案缺失。
- 视觉验收截图保存在 `.artifacts/agent-reference-screen.png` 和 `.artifacts/agent-react-screen.png`；`1440x1080` 下已确认页面高度回到原型画板高度、无横向溢出。

## SQL 工作台

- 只展示控制面返回的 AS/400 开发和测试连接。
- 支持单条 SELECT 校验以及 INSERT、UPDATE、DELETE 静态预检。
- P1 不提供 DML 执行、交互事务、Commit 或 Rollback。
- Copilot 区域当前只表达安全边界，模型能力通过评测门禁前保持禁用。
- 目标交互以主流数据库客户端为基线，包含对象浏览、多 SQL 文件标签、传统编辑器、执行工具栏和完整结果区；AI SQL 助手在右侧提供错误分析和性能优化。
- P2 计划开放开发环境受控 CRUD；生产 SQL 连接在所有阶段均不可见、不可调用。

### 2026-06-14 React 转换记录

- `/sql` 已从通用 `AppShell` 中独立出来，按 `D:\poc-ops-agent\figma-prototype\ops-agent-aia-prototype.html` 中 `id="sql-workbench-screen"` 片段还原完整 screen。
- 页面包含原型同款左侧胶囊导航、顶部 EA 胶囊、连接工具条、数据库对象浏览器、多 SQL 文件标签、SQL 编辑器视觉区、服务端校验报告、结果区和右侧 AI SQL 助手禁用区。
- 数据只通过 `src/api/sql-api.js` 调用控制面 `GET /internal/sql-workbench/connections` 与 `POST /internal/sql-workbench/queries/validate`，页面和组件不直接 `fetch`。
- SQL 编辑区为了像素级贴近原型，采用原型同结构的行号、代码文本和 DML 高亮展示；交互动作仍只进入服务端校验契约。
- 自动化测试覆盖连接目录渲染、版本化校验请求、服务端拒绝报告、生产连接契约拒绝和 AI 助手禁用状态。
- 视觉 QA 记录见仓库根目录 `design-qa.md`；参考截图为 `.artifacts/sql-reference-screen.png`，React 截图为 `.artifacts/sql-react-screen.png`。
- 本次已验证：`npm run build`，包含 `check`、`lint`、40 个 Vitest 测试和 Vite production build。
- 浏览器检查使用本地 Vite `http://127.0.0.1:5174/sql` 和 Playwright API 拦截完成；真实联调仍需启动控制面 `http://127.0.0.1:8080`。

## 本地开发

```powershell
npm install
npm run dev
```

开发服务器会把 `/auth` 和 `/internal` 请求代理到本机控制面 `http://127.0.0.1:8080`。

## 本地验证

```powershell
npm run check
npm run lint
npm run test
npm run test:e2e
npm run build
npm audit --audit-level=high
```

首次运行 Playwright 前需要安装 Chromium：

```powershell
npx playwright install chromium
```

如果本机 Playwright 浏览器下载不可用，可临时使用已安装的 Chrome：

```powershell
$env:PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH = "C:\Program Files\Google\Chrome\Application\chrome.exe"
npm run test:e2e
```

端到端测试通过浏览器路由 Mock 控制面接口，用于验证页面流程、桌面视口布局、禁用状态和关键操作可达性；它不替代后端契约测试。

## 本地 Mock OIDC 联调

默认联调方式是浏览器会话登录：

1. 启动控制面并启用 `local-oidc` profile。
2. 打开操作台首页。
3. 在已同步 `ab57a00` 的分支上，点击“使用企业 SSO 登录”；若当前分支仍是旧占位页，则直接访问 `/auth/login` 触发后端 OIDC 登录跳转。
4. 登录成功后的会话读取、主体展示和受保护页面跳转仍待登录页任务接入。
5. 诊断请求最终应复用浏览器会话访问 `/internal/**`，但当前页面还没有完成该闭环。

如需排障，不得把 Bearer Token 覆盖入口作为默认链路；当前重写版本也尚未重新实现该调试入口。

详细步骤见 [docs/runbooks/local-oidc-mock-testing.md](/C:/Users/Lenovo/Documents/ops-agent/docs/runbooks/local-oidc-mock-testing.md)。

## 本地构建

```powershell
npm run build
```

## 发布与回滚影响

- 发布影响：首轮页面只增加浏览器前端能力和只读校验入口，不开放新的生产副作用操作。
- 回滚方式：回退当前前端构建产物或回退本仓库中 `frontend/operator-console` 的相关提交；后端接口和契约不因本页面重写而改变。
- 已知后续工作：真实只读诊断工作流提交、RAG 问答页、审计详情页、SQL 查询结果分页与脱敏留存仍需后续任务完成。
