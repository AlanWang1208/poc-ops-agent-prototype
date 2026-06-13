# Team Workspace 定制闭环设计

- 日期：2026-06-13
- 相关任务：M01、M02、M03、M04、M05、M07、M09、M11
- 目标阶段：P1 只读诊断 MVP
- 状态：实施中

## 1. 背景与目标

当前平台已经从“单一组织共享边界”调整为“公司内部共享底座 + Team Workspace 逻辑隔离”。该变更的目标不是建设外部 SaaS 多租户平台，而是在同一公司内部支持多个团队独立定制只读诊断体验。

本设计目标是形成首期定制闭环：

- 一个账号可以加入多个 Team Workspace；
- 登录状态返回可访问 Team Workspace、当前 Team Workspace 和当前作用域角色；
- 诊断请求必须携带当前 Team Workspace；
- Skill 路由、策略决策、工作流、幂等、审计和语义事件都按 Team Workspace 作用域执行；
- 平台全局安全基线始终先执行，Team Workspace 规则只能等价或收紧；
- Worker 透传 Team Workspace 上下文，但仍不做授权决策。

## 2. 设计范围

纳入范围：

- 更新事实源文档、ADR、模块地图、规划和设计追溯；
- 新增 workspace-aware v2 契约；
- 身份模块增加 Team Workspace、成员关系和 workspace 作用域角色模型；
- 策略决策输入增加 Team Workspace、角色、Skill 和目标环境上下文；
- Skill 路由增加 Team Workspace 启用清单约束；
- 工作流、幂等、审计和语义事件持久化 `workspace_id`；
- 操作台显示和选择当前 Team Workspace，并在诊断和事件恢复中传递该上下文；
- 覆盖契约、身份、策略、路由、工作流和前端构建验证。

不纳入范围：

- 外部 SaaS 多租户；
- 外部客户接入；
- 商业化计费、套餐、租户运营或租户管理后台；
- 按 workspace 独立数据库、独立 Schema 或独立部署；
- 任意脚本市场；
- 生产写执行、审批绕过或策略绕过；
- 完整的 workspace 管理 UI。

## 3. 约束

- 必须遵守 `AGENTS.md` 的 P1 边界：只读诊断 MVP。
- 服务端策略仍是唯一授权决策点。
- 前端只能渲染服务端返回的角色、拒绝和事件状态，不能自行做授权判断。
- Team Workspace 是内部团队级逻辑边界，不代表外部 SaaS 租户。
- 实现字段优先使用 `workspaceId`，避免引入裸 `tenantId`。
- 平台安全基线不可被 Team Workspace 规则放宽。
- Redis 和 ChatMemory 不能作为执行事实源。
- Worker 只接收已授权、带版本和 workspace 上下文的执行请求，不做授权决策。

## 4. 当前状态

P1 只读链路已经具备身份、策略、审计、Skill 注册和路由、工作流持久化、语义事件和操作台基础能力。缺口在于这些能力原本默认落在单一组织边界内，尚未把“当前团队空间”作为身份、策略、路由、工作流、事件恢复和审计的一致维度。

已有 M05 和 M09 Superpowers 规格原本排除了所有租户相关能力。该表述需要收窄为“不做外部 SaaS 多租户和外部客户接入”；内部 Team Workspace 作为本设计定义的逻辑隔离边界纳入 P1 定制闭环。

## 5. 方案比较

### 方案 A：内部 Team Workspace 逻辑隔离

在共享部署和共享数据库内增加 `workspaceId` 维度，由身份、策略、Skill 路由、工作流、审计和事件恢复共同强制。

优点：

- 符合公司内部共享底座定位；
- 首期实现成本可控；
- 不改变 P1 只读边界；
- 可以支持团队差异化 Skill 和策略配置；
- 不引入外部 SaaS 租户运营复杂度。

缺点：

- 需要更新多个模块的契约和事实源；
- 查询、幂等和审计必须统一带 workspace，容易出现遗漏点；
- 后续需要补 workspace 配置管理和迁移策略。

### 方案 B：真正 SaaS 多租户

引入外部客户、租户管理、计费和强隔离部署模型。

优点：

- 长期商业化能力更完整。

缺点：

- 明显超出当前 V8.1 和 P1 范围；
- 会扩大安全、合规、运维和数据隔离设计面；
- 与用户明确边界冲突。

### 方案 C：仅前端做团队选择

前端选择团队后只过滤展示数据，后端仍按单组织执行。

优点：

- 实现最少。

缺点：

- 无法形成真实隔离；
- 不能防止直调 API 绕过；
- 不满足策略、审计、工作流和事件恢复的安全要求。

推荐采用方案 A。

## 6. 总体设计

### 6.1 命名与边界

产品概念统一为 `Team Workspace`。契约和代码字段使用 `workspaceId`、`workspaceCode`、`workspaceName`，不使用裸 `tenantId`。

默认开发态可以保留一个 `workspace-default`，用于兼容现有测试和本地联调。该默认值不是产品边界，只是 POC 启动路径。

### 6.2 身份与会话

身份模块增加：

- `identity_workspace`
- `identity_workspace_membership`
- `identity_workspace_role_grant`

`OperatorIdentity` 从账号全局角色升级为包含当前 workspace 和 workspace 成员关系的身份上下文。平台管理员可以作为全局例外角色存在，但审计仍必须记录实际 workspace 和操作主体。

`identity-session-status-response-v2` 返回：

- 当前用户；
- 可访问 workspace 列表；
- 当前 workspace；
- 当前 workspace 下角色；
- 登录状态和会话入口。

### 6.3 策略决策

策略输入从：

```text
operator + action + resource
```

扩展为：

```text
workspace + operator + roles + action + resource + skill + targetEnvironment
```

决策顺序：

1. 执行平台安全基线；
2. 校验用户是否属于当前 workspace；
3. 按当前 workspace 角色计算允许动作；
4. 执行 workspace 级 Skill、目标环境和参数限制；
5. 将允许、拒绝、策略版本和 workspace 写入审计事件。

### 6.4 Skill 路由

路由候选必须同时满足：

- Skill 已发布；
- P1 只读；
- 当前 workspace 启用；
- 当前 workspace 角色允许；
- 目标环境允许；
- 参数符合 Skill Schema 和 workspace 参数约束。

workspace 可以配置 Skill 参数默认值和更严格限制，但不能绕过 Skill Schema 或降低全局风险等级。

### 6.5 工作流、幂等与事件

工作流实例、attempt、事件和审计记录持久化 `workspace_id`。

幂等唯一键加入 `workspace_id`，避免不同团队使用相同 `idempotencyKey`、Skill 和参数时相互碰撞。

语义事件 v2 在顶层增加 `workspaceId`，事件恢复接口必须按：

```text
workspaceId + workflowId + afterSequence
```

查询，并校验当前用户属于该 workspace。

### 6.6 Worker 边界

Worker 执行请求和结果 v2 透传 workspace 上下文。Worker 可以记录和回传该上下文用于审计、追踪和结果归档，但不能根据 workspace 自行做授权决策。

### 6.7 操作台体验

登录状态显示可访问 workspace 列表。用户选择当前 workspace 后：

- 只展示该 workspace 的角色；
- 诊断请求携带 `workspaceId`；
- 事件恢复携带 `workspaceId`；
- Skill 列表和诊断任务按服务端返回结果展示；
- 权限不足时展示服务端拒绝结果。

## 7. 契约

新增并保留 v1 历史契约：

- `backend/contracts/api/identity/identity-session-status-response-v2.schema.json`
- `backend/contracts/workflow/read-only-command-v2.schema.json`
- `backend/contracts/workflow/worker-execution-request-v2.schema.json`
- `backend/contracts/workflow/worker-execution-result-v2.schema.json`
- `backend/contracts/events/semantic-event-v2.schema.json`

契约兼容规则：

- v1 不静默替换；
- v2 新增 workspace 字段；
- 跨模块调用优先消费 v2；
- Worker 运行时切换到 v2 前，必须保持 v1 兼容测试。

## 8. 风险与缓解

- 风险：某个查询遗漏 `workspaceId`，导致跨团队数据泄露。
  - 缓解：仓储接口签名显式携带 `workspaceId`，恢复接口校验当前身份 workspace。
- 风险：workspace 规则被误用为放宽策略。
  - 缓解：策略服务先执行平台基线，再执行 workspace 规则。
- 风险：前端选择 workspace 后与服务端身份不一致。
  - 缓解：服务端以会话身份和 membership 为准，前端选择只作为请求上下文。
- 风险：默认 workspace 兼容路径被误解为真实单租户假设。
  - 缓解：文档标注为 POC 兼容路径，后续以 workspace 配置仓储替换硬编码默认值。

## 9. 测试策略

必须覆盖：

- v2 JSON Schema 契约测试；
- 用户多 workspace membership；
- 不同 workspace 不同角色；
- 无 membership 访问被拒绝；
- 平台基线拒绝不可被 workspace 放宽；
- 同一用户在不同 workspace 得到不同 Skill 候选；
- 未启用 Skill 不可被自然语言或直调执行；
- 相同幂等键在不同 workspace 不冲突；
- 跨 workspace 查询 workflow/event 被拒绝；
- workspace 切换后诊断提交和事件恢复使用当前 workspace；
- P1 只读约束回归。

## 10. 验收标准

- 事实源文档明确允许内部团队级逻辑隔离边界，并统一命名为 Team Workspace；
- v2 身份、命令、Worker 和语义事件契约存在并通过 JSON Schema 验证；
- 控制面策略、审计、工作流、幂等和事件恢复均携带 `workspaceId`；
- 操作台可显示和选择当前 workspace；
- 无 membership 或 workspace 不匹配请求被服务端拒绝；
- P1 只读、安全基线、审计和 Worker 不授权边界保持不变；
- 相关 Superpowers 旧规格已修订外部 SaaS 多租户边界。
