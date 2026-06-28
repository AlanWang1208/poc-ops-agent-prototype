# SQL 工作台 P1 执行与会话设计

- 状态：已确认实现范围
- 日期：2026-06-27
- 相关模块：M01、M02、M05、M07、M08、M09、M10、M11
- 相关 ADR：ADR 0006、ADR 0009

## 1. 目标

本轮将 SQL 工作台从“只展示连接目录与服务端校验报告”推进到 P1 可用的受控查询工作区：

1. P1 开放开发和测试环境的单条 `SELECT` 真实执行。
2. 页面提供新建连接、新建会话、多会话切换和展开工作区能力。
3. 新建连接采用 Worker 侧预置凭据别名模式，页面只填写并引用 `credentialAlias`。
4. 服务端校验移动到右侧信息面板，中间区域聚焦编辑器、执行状态和结果。

本轮不开放生产 SQL 连接，不开放 `INSERT`、`UPDATE`、`DELETE`、DDL、`CALL`、存储过程、`MERGE` 或多语句脚本执行。

## 2. P1 执行边界

P1 的“开放执行”只表示开放受控只读查询执行：

- 允许环境：`development`、`test`。
- 允许语句：单条 `SELECT`，由控制面 Calcite 校验后进入执行信封，Worker 再次使用独立只读校验。
- 允许结果：分页、脱敏、短期留存后的 `SqlResultPage`，结果必须有过期时间。
- 禁止语句：DML、DDL、`CALL`、存储过程、`MERGE`、多语句脚本和无法可靠分类的 SQL。
- 禁止连接：生产连接不得出现在连接目录、控制面 API、Worker 配置或页面状态中。
- 禁止凭据流转：浏览器和控制面不得接收、保存、记录或回显数据库用户名、密码、连接串中的密钥材料。

DML 在 P1 仍只能进入静态预检报告。开发环境受控 DML 写执行仍属于 P2，并必须另行经过策略、持久化工作流、短事务、审计和安全评审。

## 3. 页面设计

### 3.1 顶部工作区条

顶部工作区条成为连接上下文的唯一稳定入口，显示：

- 当前连接状态，例如 `已连接 · development`。
- 连接显示名，例如 `as400-development`。
- 当前 Schema，例如 `ORDERS`。
- 结果限制，例如 `maxRows 500`。
- `新建连接` 按钮。
- `展开工作区` / `退出展开` 按钮。

左侧常驻“连接与对象”栏不再用于说明当前连接。数据库对象浏览器改为可折叠抽屉，只在用户需要浏览 Schema、表、字段时展开。

### 3.2 会话与标签

编辑器上方提供会话标签：

- 默认创建 `SQL 1`。
- `+ 新建会话` 创建新的工作台会话。
- 每个会话独立保存 SQL 文本、连接、Schema、校验报告、执行状态、结果页引用和错误状态。
- 切换会话不得丢失已完成结果或服务端校验报告。
- 工作台会话不是长期数据库连接，不暴露手动 `Commit` 或 `Rollback`。

### 3.3 中间工作区

中间区域只保留高频操作：

- SQL 编辑器。
- `校验`、`执行 SELECT`、`DML 预检`、`停止` 等工具栏按钮。
- 查询执行状态。
- 结果表、消息、分页和错误摘要。

当 SQL 不是单条 `SELECT` 时，`执行 SELECT` 必须不可用；当 SQL 属于 DML 时，仅允许 `DML 预检`。

### 3.4 右侧信息面板

右侧信息面板用于展示服务端事实，不再展示静态“执行边界”提示卡：

- 服务端校验详情。
- 语句类型、校验等级、SQL 哈希、引用对象、风险和拒绝原因。
- 执行请求、工作流、策略版本、结果过期时间和 Worker 返回状态。
- AI SQL 助手在模型评测和数据脱敏门禁通过前保持禁用或折叠，不作为 P1 执行前置能力。

### 3.5 展开工作区

`展开工作区` 与 Agent 工作区保持一致：

- 收起左侧主导航。
- 收起数据库对象抽屉。
- 收起右侧信息面板。
- 编辑器和结果区占用释放出的横向空间。
- 恢复布局时，会话、SQL 文本、校验报告和结果上下文不变。

## 4. 新建连接链路

第一版新建连接采用 `credentialAlias` 模式：

1. 管理员先在 Worker 侧 KeyStore 或后续 Secret Provider 中预置真实凭据。
2. 管理员将凭据别名告知平台管理员，例如 `as400-dev-readonly`。
3. 页面新建连接时只提交非敏感元数据和 `credentialAlias`。
4. 控制面保存连接目录元数据，不保存真实凭据。
5. Worker 在探测或执行时使用本地 `credentialAlias` 解析真实凭据。

新建连接请求字段：

- `displayName`
- `targetEnvironment`
- `platformType`
- `host`
- `port`
- `defaultSchema`
- `allowedSchemas`
- `capabilities`
- `credentialAlias`
- `maxRowsDefault`
- `timeoutSecondsDefault`

控制面必须拒绝：

- `targetEnvironment = production`
- 明文密码、用户名密码组合、JDBC URL 中的凭据或任何非白名单字段
- 空 `credentialAlias`
- 空 Schema 白名单
- 超出 P1 能力的 `capabilities`

连接创建后默认状态为 `PENDING_WORKER_BINDING`。只有 Worker 探测同时通过凭据别名解析、出口 allowlist 和只读账号验证后，连接才进入 `READY`。

## 5. 后端 API

本轮新增或扩展以下控制面 API：

- `GET /internal/sql-workbench/connections`
- `POST /internal/sql-workbench/connections`
- `POST /internal/sql-workbench/connections/{connectionId}/probe`
- `POST /internal/sql-workbench/queries/validate`
- `POST /internal/sql-workbench/queries/run`
- `GET /internal/sql-workbench/results/{resultId}`

`POST /internal/sql-workbench/queries/run` 只接受 `RUN_READ_ONLY`，并必须先复用服务端校验和连接目录校验。控制面生成短期 `SqlQueryExecutionRequest`，绑定：

- 操作人身份
- 连接、环境和 Schema
- SQL 哈希和校验哈希
- 策略决策引用
- 幂等键
- trace 上下文
- 过期时间

Worker 返回 `SqlQueryExecutionResult`，控制面再暴露给前端。前端不得直接调用 Worker。

## 6. Worker 执行要求

Worker 侧必须继续作为第二道强制边界：

- 请求过期则拒绝。
- 生产环境则拒绝。
- 非单条 `SELECT` 则拒绝。
- 未命中本地 SQL 出口 allowlist 则拒绝。
- `credentialAlias` 不存在或无法解锁则拒绝。
- 数据库账号不满足只读验证则拒绝或返回探测失败。
- JDBC 阻塞 I/O 必须在 `boundedElastic` 或等效隔离线程池执行，不得占用 WebFlux 事件循环。

Worker 探测状态使用稳定错误码：

- `READY`
- `CREDENTIAL_ALIAS_NOT_FOUND`
- `CREDENTIAL_LOCKED`
- `EGRESS_NOT_ALLOWED`
- `READ_ONLY_ACCOUNT_CHECK_FAILED`
- `PROBE_FAILED`

## 7. 审计与观测

必须审计：

- 连接创建、探测、禁用和失败原因。
- 查询校验、执行提交、Worker 返回状态和结果读取。
- 策略允许或拒绝。
- DML 预检请求和拒绝进入执行的原因。

日志和事件不得包含数据库密码、完整连接串、敏感字段原始值或未脱敏结果。指标至少包含查询执行次数、拒绝次数、Worker 错误码、执行耗时、结果过期清理数量和连接探测失败数量。

## 8. 测试与验收

后端验收：

- 生产连接创建被拒绝。
- 带明文密码字段的连接创建被拒绝。
- 缺少 `credentialAlias` 的连接创建被拒绝。
- `RUN_READ_ONLY` 只允许单条 `SELECT`。
- DML、DDL、多语句和生产环境执行被控制面与 Worker 双重拒绝。
- Worker 探测能区分凭据缺失、出口拒绝和普通执行失败。
- 查询结果分页包含过期时间，并在过期后不可读取。

前端验收：

- 页面显示顶部连接上下文，不再依赖常驻左侧连接栏。
- 可新建连接并提交 `credentialAlias`，不出现密码输入框。
- 可新建并切换多个 SQL 会话，状态互不覆盖。
- 服务端校验详情出现在右侧面板。
- 展开工作区会释放横向空间并保持会话状态。
- 只有单条 `SELECT` 可以执行；DML 只能预检。
- 所有 API 响应继续通过 Zod 校验。

浏览器验收至少覆盖 `1280px`、`1440px`、`1920px` 桌面视口；如移动视口暂不作为 P1 支持范围，需要在验收记录中明确说明。

## 9. 并行开发边界

后端开发负责：

- 版本化契约、控制面连接目录与执行 API、Worker 探测与执行、审计和测试。

前端开发负责：

- SQL 工作台布局调整、新建连接表单、多会话状态、执行与结果 API 接入、Zod Schema、组件测试和浏览器验收。

两个开发流通过本规格中的 API、状态码和字段命名对齐。除非发现安全阻断，否则不得在开发中扩大到生产连接、DML 写执行或 AI 自动执行。
