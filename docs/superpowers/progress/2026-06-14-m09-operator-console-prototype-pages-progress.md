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
