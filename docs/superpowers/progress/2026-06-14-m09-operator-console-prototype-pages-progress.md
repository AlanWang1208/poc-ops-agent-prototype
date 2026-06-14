# M09 操作台原型化页面续工进度

- 日期：2026-06-14
- 分支：`codex/operator-console-prototype-pages`
- 范围：继续完成基于原型的操作台首轮重写 Task 5 至 Task 10。

## 恢复与基线

- 已创建新分支 `codex/operator-console-prototype-pages`。
- 已在本机缓存目录准备 Node.js 22.13.0 与 npm 10.9.2，用于满足当前 Vite、ESLint、jsdom 等依赖的运行版本要求。
- 已执行 `npm install` 同步前端依赖与锁文件，结果为 `0 vulnerabilities`。
- 已完成前端基线验证：
  - `npm run check`：通过。
  - `npm run lint`：通过。
  - `npm run test`：通过，5 个测试文件，28 个测试。

## Task 5：登录页和受保护路由

- 状态：已完成。
- 完成内容：
  - 新增登录页、会话查询 Hook 和受保护路由。
  - 匿名访问受保护页面会跳转登录页，已认证访问登录页会跳转 Agent 工作台。
  - AppShell 已显示真实会话主体，并提供 `/auth/logout` 退出入口。
  - `/auth/session` 的 `401` 被归一为匿名会话；契约不兼容时进入稳定错误状态。
  - 同步修正前端登出路径，使其匹配当前后端 `/auth/logout`。
- 验证证据：
  - `npm run test -- src/features/auth/LoginPage.test.jsx`：通过，5 个测试。
  - `npm run check`：通过。
  - `npm run lint`：通过。
  - `npm run test`：通过，6 个测试文件，33 个测试。

## Task 6：Agent 工作台

- 状态：已完成。
- 完成内容：
  - 新增 Agent 工作台页面和候选 Skill 查询 Hook。
  - 调用 `/internal/routing/skills/search`，请求条件固定为 P1 只读、已验证发布候选。
  - 展示真实候选 Skill、Owner、版本、发布快照、评分和匹配规则。
  - 任务发送入口保持禁用，并显示“通用 Agent 对话接口尚未开放”。
  - 服务端 `403` 和真实空候选均进入明确反馈状态，不使用 Mock 成功数据。
  - 页面不展示模型内部推理。
- 验证证据：
  - `npm run test -- src/features/agent-workspace/AgentWorkspacePage.test.jsx`：通过，3 个测试。
  - `npm run check`：通过。
  - `npm run lint`：通过。
  - `npm run test`：通过，7 个测试文件，36 个测试。

## Task 7：Skill 注册中心

- 状态：已完成。
- 完成内容：
  - 新增 Skill 注册中心页面、Skill 查询 Hook、数据表格和状态徽标组件。
  - 调用 `/internal/skills` 读取真实 Skill 目录。
  - 支持基于真实列表的本地搜索、分类筛选和风险筛选。
  - 展示 Skill ID、风险、Owner、发布状态和选中 Skill 详情。
  - 安装、升级、卸载操作全部保持禁用，并显示“服务端未提供受控变更接口”。
  - 覆盖真实空数据、服务端 `403` 和契约不兼容状态。
- 验证证据：
  - `npm run test -- src/features/skill-registry/SkillRegistryPage.test.jsx`：通过，4 个测试。
  - `npm run check`：通过。
  - `npm run lint`：通过。
  - `npm run test`：通过，8 个测试文件，40 个测试。

## Task 8：SQL 工作台

- 状态：已完成。
- 完成内容：
  - 新增 SQL 工作台页面、Monaco SQL 编辑器封装和 SQL 工作台查询 Hook。
  - 路由 `/sql` 已从占位页切换为真实页面。
  - 调用 `/internal/sql-workbench/connections` 读取服务端允许的开发与测试环境连接。
  - 调用 `/internal/sql-workbench/queries/validate` 提交版本化 SQL 校验请求，固定包含连接、目标环境、Schema、动作、限制和幂等键。
  - 页面按钮和提交逻辑均遵循服务端返回的连接 capability 列表。
  - 提供“校验只读执行”和“DML 预检”入口，仅渲染服务端校验报告，不提供提交、回滚或写执行入口。
  - “询问 AI”保持禁用，避免在 P1 中引入未开放的模型生成链路。
  - 生产连接会被现有前端契约拒绝并显示“SQL 连接契约不兼容”，不会落入页面列表。
- 验证证据：
  - `npm run test -- src/features/sql-workbench/SqlWorkbenchPage.test.jsx`：通过，4 个测试。
  - `npm run check`：通过。
  - `npm run lint`：通过。
  - `npm run test`：通过，9 个测试文件，44 个测试。

## Task 9：浏览器流程和桌面视觉验收

- 状态：已完成。
- 完成内容：
  - 新增 Playwright 配置，覆盖 `1280px`、`1440px`、`1920px` 三个桌面视口。
  - 新增端到端用例，使用浏览器级路由 Mock 控制面接口，覆盖登录页、Agent 工作台、Skill 注册中心和 SQL 工作台。
  - 验证主导航、页面标题、关键数据、禁用态、SQL 校验提交和 DML 预检拒绝报告。
  - 增加横向溢出断言，覆盖桌面视觉验收中的层级、间距和裁切风险。
  - Playwright 配置支持通过 `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` 使用本机 Chrome；CI 可继续使用标准 Playwright Chromium。
  - Vitest 已排除 `tests/e2e/**`，避免单元测试误加载 Playwright 测试文件。
- 验证证据：
  - `npm run test:e2e`：通过，3 个桌面项目共 9 个浏览器测试。
  - `npm run test`：通过，9 个测试文件，44 个测试。
  - `npm run check`：通过。
  - `npm run lint`：通过。
