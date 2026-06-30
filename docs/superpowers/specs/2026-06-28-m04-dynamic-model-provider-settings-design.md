# M04 动态模型供应方设置设计

- 状态：已确认设计范围
- 日期：2026-06-28
- 相关模块：M01、M02、M04、M09、M10、M11
- 相关 ADR：ADR 0007

## 1. 目标

本轮将 Agent Runtime 的单一静态模型配置升级为可由管理员在操作台动态维护的模型供应方注册表：

1. 支持管理员新增、编辑、禁用和测试 OpenAI-compatible 模型供应方。
2. 支持管理员将某个已通过配置校验的供应方切换为默认模型。
3. 支持管理员在页面直接输入 API Key，但 API Key 只允许单次写入，不允许回显。
4. Agent Runtime 在每次新建 Agent workflow 时绑定当时生效的模型配置快照，后续运行可审计、可追溯。

该功能不改变 P1 只读诊断边界。模型仍只能提出诊断意图、计划摘要和只读 Tool Call，不能授予权限、绕过工作流、直接访问 Worker 或目标系统。

## 2. 非目标

- 不引入多租户、租户级模型路由、计费或外部客户配置能力。
- 不支持普通操作员配置模型供应方。
- 不支持模型输出或 Prompt 降低组织安全基线。
- 不支持在前端、日志、审计、事件或配置样例中回显 API Key。
- 不在 P1 引入按请求自由选择模型、自动成本优化、多模型并行投票或模型市场。
- 不把模型供应方配置放入 Skill 包，也不让 M07 Worker 管理模型 API Key。

## 3. 模块归属

模型供应方注册表属于 M04，因为它直接决定 Agent Runtime 如何构造模型客户端和执行 ReAct 主链路。操作台页面属于 M09，只作为管理入口。授权和审计分别由 M02 与 M10 强制执行。

模块分工如下：

- M04：模型供应方领域模型、加密密钥存储、默认供应方切换、运行时快照和 AgentScope 客户端工厂。
- M09：模型设置页面、表单校验、状态展示和测试连接入口。
- M02：新增模型配置管理动作的 RBAC 策略。
- M10：配置变更、密钥轮换、测试连接和默认切换的审计与指标。
- M11：契约测试、安全测试、密钥扫描和运行时回归。

## 4. 领域模型

新增 `ModelProvider` 聚合，字段使用英文命名：

- `providerId`：稳定标识，服务端生成。
- `displayName`：管理员可见名称。
- `providerType`：第一版固定为 `OPENAI_COMPATIBLE`。
- `baseUrl`：模型 API 基础地址，必须为 `https`，本地开发 profile 可显式允许 `http://127.0.0.1`。
- `modelName`：模型名称。
- `enabled`：是否允许用于新 Agent workflow。
- `defaultProvider`：是否为默认供应方；同一时间只能有一个默认供应方。
- `timeout`、`maxIterations`、`maxToolCalls`、`maxToolCallDuration`：运行时限制。
- `apiKeyCiphertext`：API Key 密文。
- `apiKeyFingerprint`：API Key 指纹，用于审计和页面状态，不可反推出明文。
- `apiKeyLastRotatedAt`：最近写入 API Key 的时间。
- `configVersion`：每次影响运行时的变更递增。
- `createdBy`、`createdAt`、`updatedBy`、`updatedAt`。

API Key 明文只允许存在于一次 HTTPS 请求体和服务端内存中的短生命周期变量。保存完成后，服务端响应只能返回 `apiKeyConfigured`、`apiKeyFingerprint` 和 `apiKeyLastRotatedAt`。

## 5. 加密与密钥管理

控制面使用应用层信封加密保存 API Key：

1. 部署环境提供 `OPS_AGENT_MODEL_SECRET_MASTER_KEY`。
2. 启动时校验主密钥存在、长度和格式；生产模式缺失时失败关闭。
3. 保存 API Key 时使用 AES-GCM 加密，并为每条记录生成独立随机 nonce。
4. 数据库只保存密文、nonce、算法版本和指纹。
5. 日志、异常、审计、语义事件和测试样例不得包含 API Key 明文。

第一版支持单主密钥解密。主密钥轮换作为后续安全增强，不在本轮实现；如果需要轮换，必须另行设计 key ring、重加密任务、回滚路径和恢复演练。

## 6. 持久化

新增 M04 R2DBC 仓储和版本化 SQL 迁移，使用关系型数据库作为配置事实源。表名建议：

- `agent_model_provider`

必须建立约束：

- `provider_id` 主键。
- `default_provider = true` 的启用记录最多一条。
- `display_name` 在未删除记录内唯一。
- `api_key_ciphertext`、`api_key_nonce` 不允许通过查询 API 返回。

为保持切换可审计，运行时创建 Agent workflow 时记录模型快照：

- `providerId`
- `configVersion`
- `providerType`
- `baseUrl`
- `modelName`
- `apiKeyFingerprint`

快照不包含 API Key 密文或明文。

## 7. 后端 API

新增受保护 API，路径建议放在控制面内部管理域：

- `GET /internal/model-providers`
- `POST /internal/model-providers`
- `PATCH /internal/model-providers/{providerId}`
- `POST /internal/model-providers/{providerId}/api-key`
- `POST /internal/model-providers/{providerId}/test`
- `POST /internal/model-providers/{providerId}/default`
- `POST /internal/model-providers/{providerId}/disable`

请求边界：

- 新增和更新请求只接受白名单字段。
- API Key 只能通过独立写入接口提交，便于脱敏、审计和日志过滤。
- 测试连接只验证模型供应方可用性和认证状态，不触发 Agent Tool Call，不写入业务 workflow。
- 切换默认供应方必须在事务内完成：目标 provider 已启用、已有 API Key、测试状态满足策略，然后取消旧默认并设置新默认。

响应边界：

- 列表和详情不返回 API Key 明文或密文。
- 错误响应使用稳定错误码，例如 `MODEL_PROVIDER_NOT_FOUND`、`MODEL_PROVIDER_API_KEY_MISSING`、`MODEL_PROVIDER_TEST_FAILED`、`MODEL_PROVIDER_DEFAULT_REQUIRED`。
- 供应方测试失败不得返回供应商原始错误中的密钥、请求头或完整响应体。

## 8. 运行时数据流

新建 Agent workflow 时：

1. M01 认证操作员。
2. M02 授权 `internal.agent.diagnostics.read`。
3. M05 创建 Agent workflow。
4. M04 读取当前默认且启用的 `ModelProvider`。
5. M04 解密 API Key 并构造 OpenAI-compatible AgentScope 客户端。
6. M04 将 provider 快照绑定到 workflow。
7. ReAct Tool Call 继续经 M05 平台守护执行器、M02 重新授权、M07 Worker 隔离执行。

如果管理员在 workflow 执行中切换默认模型，已创建 workflow 继续使用创建时绑定的 provider 快照；新 workflow 使用新的默认 provider。这样可以避免同一 workflow 中模型上下文漂移，并保证审计可解释。

## 9. 操作台页面

新增“模型设置”页面，仅管理员可见。页面能力：

- 查看供应方列表、默认状态、启用状态、模型名、baseUrl、API Key 是否已配置和最近轮换时间。
- 新增供应方。
- 编辑非敏感字段。
- 单独更新 API Key，输入框提交后立即清空。
- 测试连接。
- 设为默认。
- 禁用供应方。

页面不得：

- 显示 API Key 明文。
- 将 API Key 存入 URL、localStorage、sessionStorage 或浏览器日志。
- 根据展示文案推断授权状态。
- 绕过服务端策略隐藏或启用操作。

## 10. 授权与审计

新增策略动作：

- `internal.model-providers.read`
- `internal.model-providers.write`
- `internal.model-providers.api-key.rotate`
- `internal.model-providers.test`
- `internal.model-providers.switch`

默认只授予 `ROLE_ops-admin`。后续如需要职责分离，可再引入独立角色，但本轮不新增复杂审批流程。

必须审计：

- 新增模型供应方。
- 更新模型供应方非敏感字段。
- 写入或轮换 API Key。
- 测试连接成功或失败。
- 切换默认模型。
- 禁用模型供应方。

审计记录只允许包含 provider 标识、模型名、baseUrl、配置版本、API Key 指纹、操作者、策略版本、结果和 trace，不允许包含 API Key 明文、密文或 Authorization 头。

## 11. 错误处理

默认模型不存在、被禁用、缺少 API Key、解密失败或配置非法时，`/api/v1/agent/diagnostics` 必须失败关闭，返回明确错误，不得静默切换到其他模型或确定性单 Skill 路径。

供应方测试连接失败只影响该测试动作，不自动禁用当前默认模型。若默认模型在真实诊断中失败，workflow 按现有 Agent Runtime 失败路径记录终态、语义事件和审计。

## 12. 测试与验收

后端验收：

- 非管理员读取、写入、测试和切换均被拒绝。
- 创建供应方时非法 URL、空模型名、缺失 API Key 被拒绝。
- API Key 保存后列表和详情响应不包含明文或密文。
- API Key 密文可被运行时解密使用，错误主密钥无法解密并失败关闭。
- 同一时间只能有一个默认启用供应方。
- 切换默认供应方后，新 workflow 绑定新 provider，旧 workflow 保留旧快照。
- 测试连接不创建 Agent workflow，也不触发 Tool Call。
- 审计记录不包含 API Key 明文或密文。

前端验收：

- 管理员可新增、编辑、测试、设为默认和禁用供应方。
- API Key 输入提交成功后清空，页面只显示已配置状态和指纹。
- 普通用户不可见或不可执行模型设置管理动作。
- 所有 API 响应继续经过 Zod 校验。
- 页面不展示模型内部推理。

安全与 CI 验收：

- 密钥扫描通过。
- 仓库中不出现真实 API Key、供应商密钥样例或测试密钥。
- Maven 相关模块测试通过。
- 前端 `checkJs`、组件测试和相关浏览器验收通过。

## 13. 发布与回滚

发布时默认保持 `ops-agent.agent-runtime.enabled=true`。在未配置真实模型密钥或受控默认供应方前，主诊断入口必须进入运行时失败关闭，不得伪造成诊断成功；管理员新增受控模型供应方、测试通过并设为默认后，Agent Runtime 才能进入真实模型调用路径。

回滚方式：

1. 关闭 `ops-agent.agent-runtime.enabled`。
2. 保留模型供应方配置和审计记录，不删除历史密文。
3. `/api/v1/agent/diagnostics` 返回禁用状态。
4. 确定性单 Skill 只读入口继续作为联调和紧急回退路径。

如果密钥主密钥配置错误导致无法解密，系统必须失败关闭。恢复方式是还原正确主密钥并重启，不得通过日志、审计或数据库导出 API Key 明文。

## 14. 文档影响

实现时需要同步更新：

- ADR 0007：补充动态模型供应方注册表和运行时快照决策。
- `docs/runbooks/agentscope-java-primary-runtime-poc.md`：补充从操作台新增和切换模型供应方的流程。
- `docs/planning/project-plan.md` 和 `docs/planning/design-traceability.md`：记录 M04 动态模型设置能力。
- `docs/standards/p1-threat-model.md`：补充 API Key 页面输入、加密存储、审计脱敏和默认切换风险。
