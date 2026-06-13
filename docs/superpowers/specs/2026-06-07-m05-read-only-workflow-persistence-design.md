# M05 只读工作流持久化设计

## 目标

在 `P1` 阶段，为控制面增加一个最小化的关系型执行事实源，使只读诊断工作流具备持久化、幂等、失败恢复和一次受控重放能力，同时不把范围扩展到审批、DAG 编排或生产写操作。

## 范围

纳入范围：

- `backend/control-plane/modules/workflow`
- 由 `ReadOnlyDiagnosticWorkflowService` 创建的只读工作流实例
- 开发态基于嵌入式 `H2` 的关系型持久化
- 工作流状态持久化
- 幂等键查询与复用
- 可重放失败标记
- 一次受控重放
- 语义事件快照持久化
- 对应的测试、ADR、运行手册和进度证据更新

不纳入范围：

- 生产写操作
- 审批工作流
- DAG 调度
- 补偿逻辑
- 多租户能力
- 通用工作流引擎
- 前端直接触发的操作员重放
- 生产数据库上线

## 约束

- 必须遵守 `AGENTS.md` 中 `P1` 的边界：只读诊断 MVP。
- 控制面仍然是唯一的授权与重放决策点。
- Worker 在恢复决策上保持无状态。
- 关系型数据库是执行事实源。
- Redis 和 ChatMemory 不能作为执行事实源。
- 其他模块不得直接访问工作流表。
- 自动重放必须保持收敛、确定且可审计。

## 当前状态

当前 `ReadOnlyDiagnosticWorkflowService` 会路由一个已校验的只读 Skill，构造命令信封，调用 `WorkerGateway`，然后直接返回内存内的 `ReadOnlyWorkflowResult`。服务会产生有序语义事件，但不会持久化工作流状态、幂等记录、执行尝试或事件快照。如果控制面在派发过程中失败，工作流无法基于持久化状态恢复。

## 设计方案

### 架构

保持当前模块化控制面结构，只在 `M05` 内增加持久化能力。

- `ReadOnlyDiagnosticWorkflowService` 作为应用服务，负责协调持久化工作流执行。
- 新增工作流仓储，独占所有关系型访问。
- 新增工作流领域记录，表达状态、尝试和重放资格。
- `WorkerGateway` 继续作为通往 `M07` 的集成边界。
- `bootstrap` 模块负责在开发与测试环境中装配嵌入式 `H2` 数据源。

不新增新的部署单元。

### 工作流状态

使用一组小而明确的状态机：

- `PENDING`：工作流行已创建，尚未完成路由
- `ROUTED`：Skill 已选定，命令信封已持久化
- `DISPATCHING`：准备向 Worker 发起执行请求
- `RUNNING`：请求已发出，等待 Worker 结果
- `SUCCEEDED`：成功结果已持久化
- `FAILED_RETRYABLE`：瞬时失败已持久化，允许受控重放
- `FAILED_TERMINAL`：终态失败已持久化，不允许重放
- `REPLAYING`：正在进行受控重放

规则：

- `P1` 中仅只读工作流使用这套状态机。
- `SUCCEEDED` 和 `FAILED_TERMINAL` 是终态。
- 只有 `FAILED_RETRYABLE` 可以转移到 `REPLAYING`。
- `REPLAYING` 复用与首次执行相同的派发路径。

### 幂等模型

将以下组合视为同一个逻辑请求：

- `idempotencyKey`
- `operatorId`
- `targetEnvironment`
- `skillId`
- `parametersHash`

行为定义：

- 如果命中的记录处于 `SUCCEEDED`，直接返回已持久化的工作流结果和事件序列。
- 如果命中的记录处于 `PENDING`、`ROUTED`、`DISPATCHING`、`RUNNING` 或 `REPLAYING`，返回当前持久化工作流视图，不新建工作流。
- 如果命中的记录处于 `FAILED_RETRYABLE`，返回已持久化状态；是否重放仅由恢复逻辑决定，调用方不能直接触发。
- 如果命中的记录处于 `FAILED_TERMINAL`，返回终态失败结果，不重新创建工作流。

### 可重放失败策略

允许自动重放的失败必须非常收敛：

- `WorkerGateway` 超时
- 控制面到 Worker 的瞬时传输失败
- 控制面在 `DISPATCHING` 或 `RUNNING` 阶段异常退出，导致没有写入最终结果

以下情况视为终态失败：

- 没有可用的已校验 Skill 候选
- 参数校验失败
- 请求过期
- 授权或策略拒绝
- Worker 明确返回业务失败且未被显式分类为瞬时错误

### 重放策略

重放必须受控且受限：

- 自动重放次数上限固定为 `1`
- 重放时保持原始 `workflowId`、`commandId` 和 `idempotencyKey`
- 每次重放生成新的 `executionRequestId`
- 每次重放都新增一条 attempt 记录和对应的持久化语义事件
- 重放只能由控制面恢复逻辑触发
- 重放不能绕过当前持久化状态检查

### 关系模型

创建 4 张由工作流模块独占的表。

`workflow_instance`

- `workflow_id` 主键
- `idempotency_key`
- `operator_id`
- `target_environment`
- `skill_id`
- `skill_version`
- `parameters_hash`
- `status`
- `policy_decision_id`
- `policy_version`
- `trace_id`
- `request_id`
- `command_id`
- `current_attempt_no`
- `max_replay_count`
- `replay_count`
- `result_status`
- `result_schema_id`
- `result_payload_json`
- `error_code`
- `error_message`
- `created_at`
- `updated_at`
- `completed_at`

`workflow_idempotency`

- `idempotency_key`
- `operator_id`
- `target_environment`
- `skill_id`
- `parameters_hash`
- `workflow_id`
- 对逻辑请求组合建立唯一约束

`workflow_attempt`

- `workflow_id`
- `attempt_no`
- `execution_request_id`
- `attempt_kind`（`INITIAL`、`REPLAY`）
- `status`
- `started_at`
- `completed_at`
- `worker_error_code`
- `worker_error_message`
- `retryable`

主键：`workflow_id + attempt_no`

`workflow_event`

- `workflow_id`
- `sequence`
- `event_id`
- `event_type`
- `event_payload_json`
- `created_at`

主键：`workflow_id + sequence`

### 模块边界

所有新增持久化代码都保留在 `backend/control-plane/modules/workflow` 中。

职责拆分建议：

- 工作流领域记录：表达实例、尝试和状态
- 仓储：按工作流和幂等组合做 CRUD 与查询
- 持久化映射：在领域对象与 JSON 列之间转换
- 恢复服务：扫描可恢复工作流并执行一次受控重放
- 应用服务：结合仓储与 `WorkerGateway` 推进工作流状态

其他模块只能通过现有服务接口和返回的工作流结果与 `M05` 交互。

### API 行为

保持现有只读诊断接口不改 URL。

当前 POST 接口行为：

- 首次请求：创建工作流并执行
- 重复请求：如果命中相同幂等组合，则返回已有持久化工作流视图
- 不允许重复创建工作流

新增一个仅供控制面内部使用的恢复触发机制即可，`P1` 不暴露为通用操作员动作。可选实现包括：

- 启动时扫描过期的 `DISPATCHING` / `RUNNING` 工作流并尝试恢复
- 在 `bootstrap` 中调用一个内部恢复服务方法

### 语义事件

当前所有内存内生成的语义事件都需要落盘。

如果需要补充重放审计事件，最低要求是：

- 当前流程继续沿用已有事件契约类型
- 重放周期产生的事件继续挂在同一个 `workflowId` 下
- `sequence` 必须单调递增

如果现有事件类型不足以表达重放审计，再先更新事件契约。

## 实施边界

基于本设计的实现应当按以下范围推进：

1. 新增一份 `P1` 工作流持久化 ADR
2. 增加工作流持久化领域类型和仓储接口
3. 在开发与测试环境中装配嵌入式 `H2` 与初始化脚本
4. 重构 `ReadOnlyDiagnosticWorkflowService`，确保先持久化再派发
5. 增加恢复与一次受控重放行为
6. 更新测试、运行手册和验收证据

## 测试策略

必须覆盖：

- 状态迁移单元测试
- 可重放失败与终态失败分类测试
- 幂等命中路径测试
- 基于 `H2` 的仓储集成测试
- 工作流集成测试，覆盖：
  - 首次执行成功
  - 重复请求复用已有工作流
  - 瞬时派发失败进入 `FAILED_RETRYABLE`
  - 可重放失败在恢复后执行成功
  - 终态失败不会被重放
  - 过期中的工作流仅恢复一次
- `backend` 全量 `verify` 回归验证

## 风险

- `H2` 与未来正式数据库存在行为差异，因此 SQL 和仓储实现必须保持简单。
- 如果当前事件契约不足，可能需要新增一个重放审计事件类型。
- 启动恢复逻辑必须避免同一工作流被重复重放。
- 当前 Worker 传输仍缺少生产级双向认证；本设计不解决 `M07` 的传输加固问题。

## 发布

- 开发和测试环境使用嵌入式 `H2`。
- 现有 API 形状保持稳定。
- 恢复逻辑仅作用于控制面的只读工作流路径。
- 如上线失败，可禁用新的工作流持久化装配，并回滚到前一提交；设计与 ADR 文档保留，用于后续继续推进。

## 成功标准

- 只读工作流被持久化到关系型事实源。
- 重复请求不再创建重复工作流。
- 可重放失败能够在控制面规则下被恢复并且只重放一次。
- 终态失败保持终态。
- `backend` 全量 `verify` 通过。
- 运行手册与验收证据覆盖新的恢复行为和剩余限制。
