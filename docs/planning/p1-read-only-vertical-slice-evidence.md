# P1 只读诊断垂直切片验收证据

## 已验证能力

- 版本化只读命令、Worker 请求、Worker 结果和语义事件契约。
- 契约 Java 值对象拒绝非只读命令和不一致事件载荷。
- Worker 仅执行显式注册的 `node-health-read:1.1.0`。
- Worker 拒绝过期请求和未知 Skill 版本。
- 控制面确定性路由到已校验的只读 Skill，并通过 `WorkerGateway` 调用独立 Worker。
- 控制面将只读工作流、幂等键、原始命令信封、执行结果和语义事件持久化到关系型事实源。
- 控制面可在启动后扫描 `FAILED_RETRYABLE` 工作流，以及当前 attempt 已过期的 `RUNNING` / `REPLAYING` 工作流，并执行一次受控重放。
- SSE 输出强类型语义事件。
- React/TypeScript 操作台按语义事件类型渲染，不进行浏览器授权决策。
- 内置只读 Skill 数量达到 5 个。

## 自动化验证

- `Set-Location backend`
- `.\mvnw.cmd -f .\pom.xml -B -ntp verify`
- `tools/ci/check-repository.ps1`
- `tools/ci/check-contracts.ps1`
- `tools/ci/scan-secrets.ps1`
- `npm run build`，执行位置为 `frontend/operator-console`

## 本地端到端验证

2026-06-06 已启动独立 Worker 和控制面并调用 SSE 诊断接口：

- 未认证请求返回 `401`。
- 有效开发 JWT 请求返回 `200`。
- 返回事件顺序为：
  1. `WORKFLOW_STARTED`
  2. `SKILL_ROUTED`
  3. `WORKER_ACCEPTED`
  4. `WORKFLOW_COMPLETED`
- Worker 返回 `node-health-read:1.1.0` 的 `HEALTHY` 结构化结果。

2026-06-07 已补充工作流持久化与恢复验证：

- `control-plane-workflow` 模块测试覆盖：
  - 版本化迁移脚本 `sql/migrations/V001__workflow_schema.sql` 可直接初始化事实表
  - 幂等命中返回既有工作流结果
  - workflow attempt 持久化与回读
  - 成功结果与事件回读
  - `WORKER_TIMEOUT` 失败落入 `FAILED_RETRYABLE`
  - `FAILED_RETRYABLE` 工作流仅受控重放一次
  - `RUNNING` 工作流在当前 attempt 过期后触发一次受控恢复，未过期时不会误重放
  - `R2dbcReadOnlyWorkflowRecoveryIntegrationTest` 覆盖真实 R2DBC 持久化状态下的恢复闭环
- `ControlPlaneApplicationTest` 已验证：
  - `ReadOnlyWorkflowStore` 与 `ReadOnlyWorkflowRecoveryService` 已完成 Spring 装配
  - 启动期 schema 初始化后可完成最小工作流持久化查询

## 已知风险

- 真实企业 IdP 联调尚未完成。
- 远程 GitHub CI 和分支保护尚未验收。
- Worker 生产传输认证、受控网络出口和部署隔离仍需 ADR。
- 现有开发 HMAC/JWT 固定测试密钥仍需迁移为运行时生成或安全注入。
- 当前仅 `node-health-read` 具有 Worker 适配器，其余 4 个 Skill 只参与注册和路由。
- SSE 当前在 Worker 返回后输出完整事件序列，不支持执行中的增量恢复。

## 2026-06-07 M09 事件流恢复补充证据

- `R2dbcReadOnlyWorkflowStoreTest` 已覆盖按 `workflowId + afterSequence` 读取后续语义事件。
- `ControlPlaneApplicationTest` 已覆盖恢复接口 `GET /internal/diagnostics/read-only/workflows/{workflowId}/events` 的策略保护与 SSE 输出。
- `frontend/operator-console` 已增加当前工作流内自动恢复、事件去重和连接状态展示，并通过 `npm run build`。
- 当前恢复能力仍以“已落盘事件续传”为边界，不宣称支持执行中的增量事件推送。
