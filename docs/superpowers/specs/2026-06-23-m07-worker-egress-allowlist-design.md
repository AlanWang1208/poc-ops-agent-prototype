# M07 Worker 受控网络出口 Allowlist 设计

- 相关模块：M07、M09、M10、M11
- 目标阶段：P1 只读诊断 MVP
- 任务切片：M07 Worker 受控网络出口最小可验证切片
- 设计结论：在 Worker 内部新增 SQL 连接出口 allowlist，先用本地配置和单元测试证明边界，不引入生产写执行、任意脚本、mTLS 证书体系或短期凭据签发。

## 背景

P1 SQL 工作台和只读 Worker 已经具备多层限制：控制面生成已授权执行请求，Worker 拒绝过期请求，SQL Worker 只接受开发或测试环境，且通过 AST 再次拒绝非单条 `SELECT`。上一切片已经补齐控制面到 Worker 的 HMAC 传输认证，降低直接调用 Worker 的风险。

M07 仍有一个执行面缺口：当前 `SqlDataSourceRegistry.resolve(connectionId)` 只表达“连接标识到数据源”的解析接口，尚未在 Worker 内部明确绑定 `connectionId`、目标环境、主机、端口和启用状态。也就是说，未来一旦配置真实数据源，如果配置或调用路径出错，Worker 还缺少一层可测试的出口 allowlist 来证明它只会连接被批准的目标。

本切片补齐这层 Worker 内部出口策略。它是应用层安全约束，不能替代防火墙、私有网络、mTLS、系统级 egress policy、短期目标系统凭据或 Windows 强隔离。

## 目标

- 为 Worker 增加受控 SQL 出口目录，目录项包含 `connectionId`、`targetEnvironment`、`host`、`port`、`credentialAlias` 和 `enabled`。
- 在解析 JDBC `DataSource` 前校验请求中的 `connectionId` 和 `targetEnvironment` 是否与目录项匹配。
- 拒绝未知连接、禁用连接、生产环境连接、环境不匹配连接，以及 host 或 port 不在 allowlist 中的连接。
- 让 `JdbcSqlQueryExecutor` 继续只依赖 `SqlDataSourceRegistry`，由新的 registry 实现集中执行出口策略，避免把网络策略散落在 SQL 执行细节里。
- 保持 P1 只读边界：不开放生产连接，不增加写执行，不增加任意脚本，不让 Worker 做授权决策。

## 非目标

- 不实现 mTLS、证书签发、证书轮换或服务网格。
- 不实现 Windows Job Object、WDAC、容器沙箱或系统级防火墙规则。
- 不实现短期目标系统凭据签发，只保留凭据别名边界。
- 不连接真实 AS/400、Db2 for i 或任何生产数据库。
- 不修改前端授权模型，也不让前端参与出口策略判断。
- 不允许生产 SQL 连接，即使配置中出现生产环境也必须拒绝。

## 组件设计

### 连接目录模型

新增 Worker 内部值对象 `WorkerSqlConnectionDescriptor`，表示一个可被 Worker 解析的 SQL 连接目录项：

- `connectionId`：控制面和 Worker 共享的连接标识。
- `targetEnvironment`：仅允许 `development` 或 `test`。
- `host`：目标主机名或 IP。
- `port`：目标端口，范围为 `1..65535`。
- `credentialAlias`：凭据别名，仅用于后续短期凭据或 KeyStore 解锁，不保存真实密钥。
- `enabled`：是否允许当前连接被 Worker 使用。

该模型不属于跨模块契约，先放在 `backend/execution-worker` 内部。跨控制面发布连接目录、凭据 lease 或运维后台编辑目录属于后续工作。

### 出口策略

新增 `WorkerSqlEgressPolicy`，职责是验证目录项是否可以服务某次 SQL 执行请求：

1. 目录项必须存在且启用。
2. 请求 `targetEnvironment` 必须等于目录项 `targetEnvironment`。
3. 目录项环境不得为 `production`。
4. 目录项 host 和 port 必须落在 Worker 本地 allowlist 中。
5. 目录项 `credentialAlias` 必须存在但不得被记录为真实密钥。

拒绝原因使用稳定错误码，便于测试、日志和后续审计映射：

- `SQL_CONNECTION_NOT_FOUND`
- `SQL_CONNECTION_DISABLED`
- `SQL_ENVIRONMENT_MISMATCH`
- `SQL_PRODUCTION_CONNECTION_FORBIDDEN`
- `SQL_EGRESS_NOT_ALLOWED`

### Registry 组合

新增 `PolicyEnforcedSqlDataSourceRegistry`，包装现有 `SqlDataSourceRegistry`：

```text
SqlQueryExecutionRequest
  -> RestrictedSqlQueryExecutionWorker
  -> JdbcSqlQueryExecutor
  -> PolicyEnforcedSqlDataSourceRegistry
  -> WorkerSqlEgressPolicy
  -> delegate SqlDataSourceRegistry.resolve(connectionId)
```

这样 `JdbcSqlQueryExecutor` 的接口需要从 `resolve(connectionId)` 扩展到能接收完整请求上下文，或者新增一个面向 SQL 执行的解析方法。推荐保留接口名但改为 `resolve(SqlQueryExecutionRequest request)`，因为出口策略必须同时读取 `connectionId` 和 `targetEnvironment`，只传 `connectionId` 会让校验依赖外部状态。

## 错误处理

出口策略拒绝应在拿到 JDBC 连接之前发生。`RestrictedSqlQueryExecutionWorker` 捕获策略拒绝后返回 `REJECTED`，错误码使用上文稳定码；真实 JDBC 异常仍保持 `FAILED / SQL_EXECUTION_FAILED`，避免把配置拒绝和执行失败混在一起。

对策略拒绝不输出真实 host、port 或凭据别名到错误消息，运行日志和审计材料只能记录连接标识、目标环境、拒绝码和 trace。

## 配置形态

P1 先使用 Worker 本地配置，不引入远程配置中心：

```yaml
ops-agent:
  worker:
    sql-egress:
      allowed-targets:
        - host: as400-dev.internal
          port: 446
        - host: as400-test.internal
          port: 446
      connections:
        - connection-id: as400-dev-readonly
          target-environment: development
          host: as400-dev.internal
          port: 446
          credential-alias: as400-dev-readonly
          enabled: true
```

示例配置只作为运行手册说明，不提交真实主机、真实凭据或生产环境配置。

## 测试策略

- `WorkerSqlConnectionDescriptorTest`：验证字段必填、端口范围、生产环境拒绝。
- `WorkerSqlEgressPolicyTest`：覆盖允许连接、未知连接、禁用连接、环境不匹配、生产环境、host/port 不在 allowlist。
- `PolicyEnforcedSqlDataSourceRegistryTest`：验证策略拒绝发生在 delegate resolve 之前，允许场景才调用 delegate。
- `RestrictedSqlQueryExecutionWorkerTest`：补充策略拒绝映射为 `REJECTED` 的行为，保持现有过期请求、生产环境和非只读 SQL 拒绝测试。
- 现有 `JdbcSqlQueryExecutorTest`、Worker 模块测试和后端 Maven `verify` 必须继续通过。

## 发布与回滚

发布时先以空连接目录启动，确认 Worker 仍拒绝真实 SQL 连接；再在开发或测试环境添加单个只读连接目录项，并验证：

1. 合法连接返回执行成功或进入受控 JDBC 错误路径。
2. 未配置连接返回 `SQL_CONNECTION_NOT_FOUND`。
3. 修改 host 或 port 后返回 `SQL_EGRESS_NOT_ALLOWED`。
4. 生产环境连接返回拒绝。

回滚方式是清空或禁用 Worker SQL 出口目录。回滚后 SQL 工作台应回到“已通过 SQL 校验但无真实连接配置”的安全失败状态，不得绕过出口策略直连目标系统。

## 后续工作

- 用 ADR 明确生产 mTLS、私有网络、防火墙和 Windows 隔离方案。
- 将 `credentialAlias` 接入短期凭据 lease，而不是长期 KeyStore 密码。
- 将出口拒绝事件映射到 M10 指标和集中审计事件。
- 对真实开发和测试 AS/400 联调建立独立运行手册和人工验收证据。
