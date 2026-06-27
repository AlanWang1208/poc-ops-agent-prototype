# 执行 Worker

执行 Worker 是 M07 的独立部署受限执行边界。

## 主要职责

- 校验已授权、带版本的执行请求。
- 强制实施资源、工作区、网络和凭据限制。
- 执行已批准的 Skill 适配器。
- 返回强类型结果以及安全和审计事件。
- 可靠终止执行并清理资源。

## 禁止事项

- 自行进行授权或审批决策。
- 接受任意未签名 Skill 定义。
- 使用生产长期凭据。
- 在运行时从公网安装依赖。
- 将 Job Object 或 WDAC 视为完整隔离。

## 配置型 HTTP/JSON Skill 边界

- 简单第三方 HTTP/JSON 只读 Skill 优先通过 `ConfiguredHttpReadOnlySkillAdapter` 配置接入，不为每个 Skill 新增专用 Java 适配器。
- Worker 在发起 HTTP 请求前会先执行 `ops-agent.worker.http-egress.allowed-targets` allowlist；默认 allowlist 为空，拒绝所有 HTTP 目标。
- 配置型适配器只支持单查询参数、JSON 响应和响应字段白名单；不执行第三方脚本，不读取环境变量，不支持在配置中保存 API Key。
- 需要密钥、专用认证、SDK、复杂协议或目标系统会话的 Skill，必须先完成安全评审，并以专用适配器或内部受控网关方式接入。
- 当前 `weather-current-read:1.0.0` 使用该通用适配器配置；默认 `endpoint-url` 为空，因此未配置受控天气源时会失败关闭。

## SQL 工作台 P1 边界

- SQL 工作台 Worker 侧代码位于 `backend/execution-worker-sqlworkbench`，由 `execution-worker` 作为运行时依赖加载；这不新增部署服务或模块编号。
- SQL 查询入口会在 Worker 内再次使用 AST 校验，只接受单条 `SELECT`。
- Worker 在解析 JDBC `DataSource` 前会先执行本地 SQL 出口 allowlist；默认 allowlist 为空，因此未显式配置的连接会被拒绝。
- SQL 连接目录只允许 `development` 和 `test` 环境，并且只保存连接元数据和凭据别名，不保存真实密码或密钥。
- JTOpen 仅用于 Db2 for i JDBC 适配，不允许控制面或浏览器直接连接 AS/400。
- 当前默认执行器未配置真实连接和 KeyStore；只有通过 allowlist 的开发或测试连接才会继续进入后续连接解析。
- P1 真实联调允许管理员启动时人工解锁 Java KeyStore；P2 前必须替换为无人值守安全解锁。
- SQL 出口 allowlist 是应用层保护，不替代防火墙、私有网络、mTLS、短期目标系统凭据或 Windows 隔离。

## 传输认证边界

- 控制面到 Worker 的 P1 HTTP 调用支持应用层 HMAC 签名认证。
- 启用 `ops-agent.worker.transport-auth.enabled=true` 后，Worker 会校验 Key ID、时间戳漂移和请求签名。
- 未签名、错误签名或时间漂移过大的请求会在 HTTP 边界返回 `401`，不会进入执行器。
- Worker 绑定非回环地址时必须启用传输认证，否则启动保护会失败。
- 该机制不替代 mTLS、私有网络、防火墙、短期目标系统凭据或 Windows 隔离。

## 构建结构

执行 Worker 现在拆分为两个 Maven 构建模块：

- `execution-worker`：通用 Worker 启动、传输认证、HTTP 边界和配置型只读 Skill 适配器。
- `execution-worker-sqlworkbench`：SQL 工作台 Worker 侧只读拒绝、SQL 出口 allowlist、JDBC 执行和短期结果存储适配器。
