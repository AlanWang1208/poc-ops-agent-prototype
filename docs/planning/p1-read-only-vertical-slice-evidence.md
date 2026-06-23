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
## 2026-06-23 M09 登录登出与本地门禁补充证据

- 登录页已接入现有 `POST /auth/login`，保留用户名与密码输入，登录成功后进入 `/overview`。
- 操作台登出入口已接入服务端登出流程，退出后回到 `/login`。
- 后端控制面以 `built-in` 登录模式启动后，`GET /actuator/health` 返回 `{"status":"UP","groups":["liveness","readiness"]}`。
- `backend` 执行 `.\mvnw.cmd verify` 通过，15 个 Maven reactor 模块均为 `SUCCESS`。
- `frontend/operator-console` 执行 `npm run build` 通过，包含 `checkJs`、ESLint、Vitest 和 Vite 生产构建；Vitest 结果为 10 个测试文件、88 个测试通过。
- `frontend/operator-console` 执行 `npm run test:e2e` 通过，Playwright 在 `1280px`、`1440px`、`1920px` 三个桌面视口共 9 个浏览器测试通过。
- `frontend/operator-console` 执行 `npm audit --audit-level=high` 通过，结果为 `found 0 vulnerabilities`。
- 仓库级 `tools/ci/check-repository.ps1`、`tools/ci/check-contracts.ps1` 和 `tools/ci/scan-secrets.ps1` 均通过。

本轮本地自动化门禁已满足 P1 只读诊断 MVP 的提交验收条件。正式里程碑验收仍需结合远程 CI、分支保护、评审签署，以及“已知风险”中列出的生产加固项逐项确认。

## 2026-06-23 T010 审计保留与恢复补充证据

- 已新增 `docs/runbooks/audit-retention-and-recovery.md`，明确 P1 文件审计的保留周期、归档步骤、恢复流程、访问控制和故障处理。
- 已在 `docs/runbooks/identity-policy-audit.md` 增加审计运行手册入口，避免身份、策略与审计联调说明承载过多运维细节。
- 已更新 `docs/runbooks/README.md` 和 `docs/planning/project-plan.md`，将 T010 进度调整为 96%，并保留集中审计存储和真实环境恢复演练作为剩余条件。

本补充不改变当前代码实现和部署边界；P1 仍采用追加式 JSONL 文件审计，正式集中审计存储或组织级备份系统接入仍属于后续环境落地事项。

## 2026-06-23 M07 Worker 传输认证补充证据

- 已新增控制面到 Worker 的应用层 HMAC 签名契约，签名绑定执行请求 ID、命令、工作流、Skill、策略、trace 和参数摘要。
- Worker HTTP 边界在认证启用时会拒绝未签名、错误签名和时间漂移过大的请求。
- Worker 非回环绑定且未启用传输认证时启动保护失败，避免把未认证 Worker 暴露到跨主机网络。
- 已新增 ADR `docs/adr/0008-m07-worker-transport-auth-and-deployment-isolation.md` 和运行手册 `docs/runbooks/m07-worker-transport-auth.md`。

本补充仍不宣称完成完整生产隔离。mTLS、受控网络出口、短期目标系统凭据、Windows 隔离部署方案和生产演练仍是 M07 后续条件。
