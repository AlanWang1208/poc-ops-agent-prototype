# M07 Worker 传输认证最小切片设计

- 相关模块：M05、M07、M10、M11
- 目标阶段：P1 只读诊断 MVP
- 关联风险：绕过控制面直接调用 Worker、重放短期执行请求、Worker 生产部署误绑定非回环地址

## 背景

当前 P1 只读诊断链路已经由控制面完成身份认证、策略授权、Skill 路由和工作流持久化，再通过 `WorkerGateway` 调用独立 `execution-worker`。Worker 会拒绝过期请求和未注册 Skill，但 HTTP 边界当前没有调用方认证；开发环境依赖 `127.0.0.1` 绑定降低风险。

P1 项目计划中 M07 的剩余条件是生产传输认证、网络出口、短期凭据和部署隔离 ADR。本设计收敛其中第一步：在不增加写执行能力、不改变 Skill 执行范围的前提下，为控制面到 Worker 的调用增加可自动化验证的应用层签名。

## 目标

- 控制面调用 Worker 时，为每个 `WorkerExecutionRequest` 增加短期 HMAC 签名头。
- Worker 在 Controller 边界验证签名、Key ID、时间戳、时间漂移和请求绑定字段。
- 未签名、签名错误、过期或时间漂移过大的请求不会进入 `RestrictedReadOnlyExecutionWorker`。
- 签名载荷绑定请求核心字段和参数摘要，降低请求体被中途篡改或重放的风险。
- 保留本地开发回环模式，但生产非回环部署必须启用传输认证。

## 非目标

- 不实现生产写执行。
- 不开放任意脚本执行。
- 不让 Worker 自行做授权或审批决策。
- 不在本切片内完成 mTLS、证书轮换、Windows Job Object、WDAC 或完整网络 ACL。
- 不把共享签名密钥写入源码、示例配置或测试外的运行文档。

## 推荐方案

采用“应用层 HMAC 签名 + 部署 ADR 约束”的方式。

控制面根据 `WorkerExecutionRequest` 生成以下请求头：

- `X-Ops-Agent-Worker-Key-Id`
- `X-Ops-Agent-Worker-Timestamp`
- `X-Ops-Agent-Worker-Signature`

签名算法为 HMAC-SHA256，签名输入使用版本化 canonical payload。payload 至少包含：

- 签名协议版本。
- Key ID。
- 请求时间戳。
- Worker 请求版本、`executionRequestId`、`authorizedAt`、`expiresAt`。
- 命令版本、`commandId`、`workflowId`、`idempotencyKey`、`commandType`、`targetEnvironment`。
- Skill ID、Skill 版本、输入 Schema、输出 Schema。
- 操作人主体、策略决策 ID、策略版本、策略结果。
- Trace ID、Request ID。
- 参数 JSON 的 SHA-256 摘要。

Worker 使用同一 canonical payload 重算签名，并要求：

- 签名 Key ID 与本地配置一致。
- 时间戳在允许漂移窗口内，默认 30 秒。
- 签名与本地密钥计算结果常量时间匹配。
- 请求自身仍未超过 `expiresAt`。

## 配置

控制面新增配置：

```yaml
ops-agent:
  worker:
    transport-auth:
      enabled: true
      key-id: ${OPS_AGENT_WORKER_KEY_ID}
      shared-secret: ${OPS_AGENT_WORKER_SHARED_SECRET}
```

Worker 新增配置：

```yaml
ops-agent:
  worker:
    transport-auth:
      enabled: true
      key-id: ${OPS_AGENT_WORKER_KEY_ID}
      shared-secret: ${OPS_AGENT_WORKER_SHARED_SECRET}
      max-clock-skew: 30s
```

本地开发可保持禁用，但如果 Worker 绑定地址不是回环地址，必须启用传输认证；否则启动失败。

## 错误处理

- 缺少认证头：返回 `401`。
- Key ID 不匹配、签名错误或时间漂移超限：返回 `401`。
- 请求体自身过期：保留现有 Worker 结构化 `REJECTED` 结果。
- 配置不完整且启用传输认证：应用启动失败。

Worker 的认证拒绝属于传输层拒绝，不生成 `WorkerExecutionResult`，避免把未认证请求纳入执行事实。

## 测试策略

- 合约模块测试签名 canonical payload 的确定性，并验证参数变化会导致签名变化。
- Worker HTTP 测试覆盖未签名、错误签名、时间漂移超限和合法签名。
- 控制面网关测试覆盖签名头注入。
- 现有只读执行和 SQL 只读拒绝测试必须保持通过。

## 发布与回滚

发布时先在开发或联调环境启用相同 Key ID 和密钥，再启用 Worker 非回环绑定或跨主机访问。回滚时可先将 Worker 重新绑定回环地址，再临时关闭 `transport-auth.enabled`；不得在非回环生产地址上关闭传输认证。

## 后续工作

- 编写 M07 生产部署隔离 ADR，覆盖 mTLS、私有网络、出站 allowlist、独立服务账号、短期目标系统凭据和 Windows 隔离策略。
- 在 M10 部署手册中加入密钥轮换、时间同步和传输认证告警。
- P2/P3 再评估 WORM 审计、强隔离沙箱和无人值守安全解锁。
