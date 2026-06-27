# 本地只读诊断垂直切片

## 目的

本手册用于验证开发环境中的完整只读链路：

`操作员 -> 控制面身份与策略 -> Skill 路由 -> 独立 Worker -> 语义事件 -> 审计`

## 启动

需要 Java 21，并设置 `JAVA_HOME`。

1. 启动独立 Worker：

   ```powershell
   Set-Location backend
   .\mvnw.cmd -f .\execution-worker\pom.xml spring-boot:run
   ```

2. 在另一终端启动控制面：

   ```powershell
   Set-Location backend
   .\mvnw.cmd -f .\control-plane\bootstrap\pom.xml spring-boot:run
   ```

3. 启动操作台：

   ```powershell
   Set-Location frontend/operator-console
   npm install
   npm run dev
   ```

## 安全边界

- Worker 默认仅监听 `127.0.0.1:8091`，不得直接作为生产部署配置。
- Worker 仅允许显式注册的只读适配器，不会加载任意脚本；`node-health-read:1.1.0` 可直接执行，配置型 HTTP/JSON Skill 默认因未配置出口和端点而失败关闭。
- 控制面诊断入口必须通过身份、策略和审计过滤器。
- 控制面会把只读工作流持久化到 `var/workflow/control-plane` 下的本地 H2 文件库。
- 控制面启动时会执行版本化迁移脚本 `sql/migrations/V001__workflow_schema.sql` 初始化 M05 事实表。

## 验证

- 未认证请求返回 `401`。
- 角色不足请求返回 `403`。
- 有效请求返回顺序递增的四个语义事件。
- Worker 过期请求返回 `REQUEST_EXPIRED`。
- 未允许的 Skill 版本返回 `SKILL_NOT_ALLOWED`。
- 同一幂等键重复请求会复用既有工作流，而不是重复创建新实例。
- 启动恢复开启时，控制面会扫描 `FAILED_RETRYABLE` 工作流，以及当前 attempt 已过期的 `RUNNING` / `REPLAYING` 工作流，并执行一次受控重放。

## 回滚

停止控制面和 Worker 进程即可终止开发切片。若需清空本地工作流事实源，可在停止进程后删除 `var/workflow/control-plane*` 开发数据库文件。回滚代码时部署上一已通过全量 `verify` 的 Commit。

## 2026-06-07 M09 事件流恢复补充

- 当前操作台会在页面内保存最近一次工作流的 `workflowId` 与最新 `sequence`。
- 当 `/internal/diagnostics/read-only/events` 在终态前中断时，前端会自动切换到 `GET /internal/diagnostics/read-only/workflows/{workflowId}/events?afterSequence=<n>`。
- 恢复接口只回放关系型事实源中 `sequence > afterSequence` 的已落盘事件，不会重新创建工作流，也不会再次提交 Worker。
- 操作台对恢复返回的事件按 `eventId` 去重，并保持 `sequence` 递增展示。
- 收到 `WORKFLOW_COMPLETED` 或 `WORKFLOW_FAILED` 后，前端停止自动重连。
