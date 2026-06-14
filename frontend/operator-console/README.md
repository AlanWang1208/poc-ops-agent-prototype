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

## SQL 工作台

- 只展示控制面返回的 AS/400 开发和测试连接。
- 支持单条 SELECT 校验以及 INSERT、UPDATE、DELETE 静态预检。
- P1 不提供 DML 执行、交互事务、Commit 或 Rollback。
- Copilot 区域当前只表达安全边界，模型能力通过评测门禁前保持禁用。
- 目标交互以主流数据库客户端为基线，包含对象浏览、多 SQL 文件标签、传统编辑器、执行工具栏和完整结果区；AI SQL 助手在右侧提供错误分析和性能优化。
- P2 计划开放开发环境受控 CRUD；生产 SQL 连接在所有阶段均不可见、不可调用。

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
3. 点击“使用本地 Mock OIDC 登录”。
4. 登录成功后，页面会显示当前主体和角色。
5. 诊断请求默认复用浏览器会话访问 `/internal/**`。

如需排障，页面保留可折叠的 Bearer Token 覆盖入口，但这不是默认链路。

详细步骤见 [docs/runbooks/local-oidc-mock-testing.md](/C:/Users/Lenovo/Documents/ops-agent/docs/runbooks/local-oidc-mock-testing.md)。

## 本地构建

```powershell
npm run build
```

## 发布与回滚影响

- 发布影响：首轮页面只增加浏览器前端能力和只读校验入口，不开放新的生产副作用操作。
- 回滚方式：回退当前前端构建产物或回退本仓库中 `frontend/operator-console` 的相关提交；后端接口和契约不因本页面重写而改变。
- 已知后续工作：真实只读诊断工作流提交、RAG 问答页、审计详情页、SQL 查询结果分页与脱敏留存仍需后续任务完成。
