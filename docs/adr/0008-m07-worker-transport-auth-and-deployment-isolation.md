# ADR 0008：M07 Worker 传输认证与部署隔离边界

- 状态：Accepted
- 日期：2026-06-23
- 负责人：架构负责人
- 相关模块：M05、M07、M08、M10、M11
- 相关任务：P1 只读诊断 MVP、M07 受限执行 Worker

## 背景

P1 只读诊断链路已经由控制面完成身份认证、策略授权、Skill 路由、工作流持久化和审计，再将短期有效的 `WorkerExecutionRequest` 提交给独立 `execution-worker`。Worker 已经能拒绝过期请求、未知 Skill 版本和非只读 SQL，但 HTTP 边界此前主要依赖开发环境回环地址绑定。

项目安全规则要求控制面不得直接执行脚本或持有目标系统长期凭据，Worker 不得自行授权，并且 Worker 必须使用最小权限身份、受限工作区、受控网络出口和短期凭据。M07 当前剩余风险是：如果未来将 Worker 绑定到非回环地址，未认证调用方可能绕过控制面直接访问 Worker。

## 决策

P1 采用应用层 HMAC 签名作为控制面到 Worker 的最小传输认证机制：

1. 控制面调用 Worker 时，如果 `ops-agent.worker.transport-auth.enabled=true`，必须注入：
   - `X-Ops-Agent-Worker-Key-Id`
   - `X-Ops-Agent-Worker-Timestamp`
   - `X-Ops-Agent-Worker-Signature`
2. 签名 payload 由 `WorkerExecutionRequest` 的版本、请求 ID、命令 ID、工作流 ID、幂等键、只读操作类型、目标环境、Skill 版本、操作人、策略引用、trace 和参数摘要组成。
3. Worker 在 Controller 边界验证 Key ID、时间戳漂移和 HMAC 签名；认证失败返回 `401`，不会进入执行器。
4. Worker 如果绑定非回环地址且未启用传输认证，启动保护必须失败。
5. HMAC 签名只作为 P1 最小认证；生产部署仍必须叠加私有网络、入站防火墙、出站 allowlist、独立服务账号、短期目标系统凭据和后续 mTLS。

## 考虑过的备选方案

### 仅依赖回环地址和防火墙

拒绝作为目标态。回环地址适合本地开发，但不能作为跨主机生产传输认证。

### 直接在 P1 实现完整 mTLS

暂缓。mTLS 是后续生产化目标，但当前仓库缺少证书发行、轮换、部署平台和运维流程；直接落代码会扩大 P1 范围，并且难以在本地 CI 中形成稳定证据。

### Worker 自行校验操作人角色

拒绝。Worker 只能接受控制面已授权请求，不得自行进行授权决策；否则会破坏 M02 的唯一授权决策点。

## 影响

正面影响：

- 直接调用 Worker 的未签名请求会被拒绝。
- 错误签名、错误 Key ID 和时间漂移过大的请求会被拒绝。
- 非回环地址误绑定在未启用认证时会启动失败。
- 签名逻辑有跨模块自动化测试覆盖。

限制和剩余风险：

- HMAC 共享密钥需要部署系统安全注入和轮换。
- 应用层签名不替代 mTLS，也不替代网络隔离。
- 当前未实现目标系统短期凭据发放；SQL 工作台真实凭据仍按 P1 手册保持不可用或人工解锁边界。
- Windows Job Object、WDAC 和强隔离仍需后续部署 ADR 和安全评审。

## 验证方式

- `WorkerRequestSignatureTest` 覆盖签名稳定性、参数篡改和空密钥拒绝。
- `WorkerExecutionControllerTest` 覆盖合法签名成功、缺少签名拒绝、错误签名拒绝和时间漂移拒绝。
- `WorkerBindingSafetyGuardTest` 覆盖回环地址、非回环地址和认证启用组合。
- `WebClientWorkerGatewayTest` 覆盖控制面签名头注入和禁用模式。
- 后端全量 `verify`、仓库规范检查、契约检查和密钥扫描必须通过。

## 发布与回滚

发布步骤：

1. 在控制面和 Worker 运行环境中注入相同 Key ID 和共享密钥。
2. 先在回环或私有网络联调环境启用 `transport-auth.enabled=true`。
3. 验证合法请求成功、未签名请求返回 `401`。
4. 再评估是否允许 Worker 绑定非回环地址。

回滚方式：

1. 如果签名配置导致联调失败，先将 Worker 重新绑定回环地址。
2. 在回环开发模式下可临时关闭 `transport-auth.enabled`。
3. 禁止在非回环生产地址上关闭传输认证。
4. 回滚后必须保留 M07 已知风险，直到 mTLS、网络隔离和短期凭据方案完成。
