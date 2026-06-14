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
