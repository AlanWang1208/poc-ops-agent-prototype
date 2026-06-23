# M09 Agent 工作区只读诊断全流程设计

- 日期：2026-06-23
- 相关模块：M03、M04、M05、M07、M09、M11
- 目标阶段：P1 只读诊断 MVP
- 任务切片：M09 Agent 工作区只读事件流接入
- 状态：历史设计，已被后续 Agent 主诊断入口接入切片替代
- 设计结论：当时采用方案 A，让 Agent 工作区直接接入现有 `node-health-read@1.1.0` 只读事件流，先跑通页面到控制面、持久化工作流、独立 Worker、语义事件和结果展示的闭环；不新增 Skill，不启用 AgentRuntime，不引入生产写执行。当前事实源以后续 `frontend/operator-console/README.md`、`docs/architecture/module-map.md` 和 `docs/adr/0007-agentscope-java-primary-agent-runtime.md` 为准，Agent 工作台主提交入口已经切换为 `/api/v1/agent/diagnostics`。

## 背景

Agent 工作区页面已经完成首轮视觉和候选 Skill 查询。当前页面可以从 `/internal/routing/skills/search` 读取只读、已验证发布的候选 Skill，但任务发送仍保持禁用，工作会话中的 workflow 卡片和事件展示仍是静态演示内容。

后端已经存在 P1 只读诊断垂直切片：

```text
操作员
  -> 控制面身份与策略
  -> Skill 路由
  -> M05 持久化只读工作流
  -> M07 独立 Worker
  -> M08 node-health-read 适配器
  -> M09 强类型语义事件
  -> M02 / M10 审计与可观测
```

其中真正可执行的 Worker 适配器是 `node-health-read@1.1.0`。其他已注册 Skill 当前主要用于目录、路由和发布校验展示。另一个 `/api/v1/agent/diagnostics` 入口属于 AgentRuntime 路径，在该历史切片设计时默认关闭且不适合本次证明 Worker 全链路；当前它已经成为 Agent 工作台主诊断入口。

本切片选择最小可验证路径：让 Agent 工作区的发送入口调用现有 `/internal/diagnostics/read-only/events`，并在页面内展示服务端返回的强类型事件和节点健康结果。

## 目标

- 启用 Agent 工作区的发送按钮，触发现有 `node-health-read@1.1.0` 只读诊断。
- 使用服务端策略保护的 `/internal/diagnostics/read-only/events` 作为唯一执行入口。
- 请求固定为 P1 演示闭环：
  - `skillId=node-health-read`
  - `targetEnvironment=development`
  - `parameters.nodeName=node-a`
- 页面展示 `WORKFLOW_STARTED -> SKILL_ROUTED -> WORKER_ACCEPTED -> WORKFLOW_COMPLETED` 或 `WORKFLOW_FAILED` 的强类型事件序列。
- 完成时展示 Worker 输出的节点健康结果，包括节点名、健康状态、CPU、内存、磁盘和最近心跳时间。
- 失败或拒绝时展示稳定错误状态，不把拒绝伪装成成功。
- 保留现有 Agent 工作区视觉语言和布局，只把演示态升级为可运行交互。
- 继续禁止展示模型内部推理过程。

## 非目标

- 不新增 Skill Manifest、签名文件或 Worker 适配器。
- 该历史切片不启用 `/api/v1/agent/diagnostics` 或 AgentRuntime；当前 Agent 工作台主提交入口已经由后续切片切换为 `/api/v1/agent/diagnostics`。
- 不引入模型计划生成、ReAct 自动工具调用或多 Skill 编排。
- 不开放生产写执行、任意脚本执行、审批绕过或高风险执行。
- 不让浏览器决定授权、风险等级、Skill 是否可执行或 Worker 是否可信。
- 不连接生产目标系统，不引入真实长期凭据。
- 不重做 Agent 工作区视觉，不新增页面路由。

## 设计范围追溯

本切片对应 V8.1 设计中的以下能力：

- M03：使用已版本化、已发布校验的 Skill 契约。
- M04：使用服务端候选 Skill 路由结果约束可用能力。
- M05：通过持久化只读工作流和幂等键记录执行事实。
- M07：只向独立 Worker 提交已授权、短期有效的只读执行请求。
- M09：操作台渲染强类型语义事件和结果，不从展示文本推断安全状态。
- M11：用组件测试、契约校验和浏览器验收证明闭环。

该切片是实现 P1 只读诊断闭环的工程机制，不改变公司内部自研自用、单组织部署的产品边界。

## 前端交互设计

### 默认状态

页面加载后继续读取候选 Skill。若候选中包含 `node-health-read@1.1.0`，发送按钮进入可用状态；若候选查询失败、没有候选或服务端返回 `403`，发送按钮保持禁用并展示服务端拒绝或不可用状态。

输入框仍保留当前任务目标文案，但本切片不做自由文本解析。为避免浏览器把自然语言变成执行参数，首轮发送固定的受控开发参数 `nodeName=node-a`。

### 发送状态

点击发送后：

1. 前端生成新的幂等键，格式使用可追踪前缀和随机 UUID。
2. 调用 API 模块提交只读诊断事件流请求。
3. 按服务端事件流增量更新当前 workflow。
4. 发送按钮在运行期间禁用，避免同一页面重复提交。
5. 页面状态显示为执行中，并清空上一轮临时错误。

### 事件展示

页面只消费 `semanticEventSchema` 校验通过的事件。事件按 `eventId` 去重，并按 `sequence` 升序展示。

侧栏“Skill 与事件”显示：

- 当前 Skill：`node-health-read`
- 最近事件：最新事件 `type`
- sequence：最新序号和事件总数

工作会话内新增或更新当前 workflow 卡片：

- `WORKFLOW_STARTED`：显示工作流创建。
- `SKILL_ROUTED`：显示 Skill 和版本。
- `WORKER_ACCEPTED`：显示 Worker 已接收请求。
- `WORKFLOW_COMPLETED`：显示完成状态和结果摘要。
- `WORKFLOW_FAILED`：显示失败状态和错误码。

### 结果展示

当收到 `WORKFLOW_COMPLETED` 时，从 `payload.output` 中读取并展示：

- `nodeName`
- `status`
- `cpuUsagePercent`
- `memoryUsagePercent`
- `diskUsagePercent`
- `lastHeartbeatAt`

这些字段仍然来自不可信边界，必须经过 Zod 输出 Schema 校验后才能进入页面状态。缺少字段时展示契约不兼容错误，而不是尝试从文本中解析。

### 失败和拒绝状态

- `401`：沿用现有认证处理，进入登录或会话失效状态。
- `403`：展示策略拒绝，不启用发送按钮。
- Worker 返回 `REJECTED`：渲染 `WORKFLOW_FAILED` 和稳定错误码。
- 网络失败：展示可重试状态，但不模拟成功。
- SSE 数据不符合 Schema：停止本轮展示并显示契约错误。

## API 与数据边界

新增或扩展前端 API 模块能力：

```text
AgentWorkspacePage
  -> useReadOnlyDiagnosticWorkflow
  -> agent-api.js
  -> POST /internal/diagnostics/read-only/events
  -> semanticEventSchema
  -> Agent 工作区状态
```

请求体：

```json
{
  "skillId": "node-health-read",
  "targetEnvironment": "development",
  "idempotencyKey": "agent-workspace-node-health-<uuid>",
  "parameters": {
    "nodeName": "node-a"
  }
}
```

前端 API 模块负责处理 `text/event-stream`。实现时可以用 `fetch` 读取响应流并解析 SSE 帧，但页面组件不得直接调用 `fetch`。解析出的 `data` 必须逐条通过 `semanticEventSchema`。

## 状态模型

Agent 工作区新增本地状态：

- `idle`：尚未提交。
- `running`：已提交并正在接收事件。
- `succeeded`：收到 `WORKFLOW_COMPLETED`。
- `failed`：收到 `WORKFLOW_FAILED` 或 Worker 失败事件。
- `denied`：服务端返回 `403`。
- `contractError`：SSE 或结果数据不符合前端 Schema。

运行状态只用于页面展示，不作为授权或执行事实源。

## 安全与审计约束

- 浏览器只提交固定开发环境只读请求，不允许用户改成生产环境。
- 浏览器不持有 Worker 地址、目标系统凭据或 Skill 执行逻辑。
- 控制面仍是唯一策略决策点，Worker 不做授权决策。
- 发送入口只能在服务端候选 Skill 可用时启用。
- 事件展示只使用服务端强类型事件，不展示模型内部推理。
- 错误信息不得包含密钥、凭据别名、真实生产主机或敏感制品。

## 测试策略

### 前端测试

采用测试先行实现以下行为：

- 候选 Skill 成功且包含 `node-health-read` 时，发送按钮可用。
- 点击发送会调用 `/internal/diagnostics/read-only/events`，请求体包含固定 Skill、环境、幂等键和 `nodeName=node-a`。
- 页面按顺序渲染四个成功事件。
- 完成后展示节点健康结果字段。
- `403` 拒绝时展示拒绝状态并保持发送按钮禁用。
- `WORKFLOW_FAILED` 时展示失败错误码。
- SSE 数据不符合 Schema 时展示契约错误。
- 页面源码仍不包含“模型内部推理”展示文案。

### 后端测试

后端当前已有只读工作流、恢复事件和 Worker 适配器测试。本切片只在发现覆盖缺口时补充后端回归，不为了前端接入重复测试已覆盖的工作流路径。

### 端到端验收

本地验收步骤：

1. 启动 Worker。
2. 启动控制面。
3. 启动操作台。
4. 登录或使用已有开发认证。
5. 打开 `/agent`。
6. 点击发送任务。
7. 确认页面展示事件链、工作流终态和节点健康结果。
8. 查看审计与工作流事实源，确认请求经过策略和持久化链路。

## 发布与回滚

发布方式：

- 前端以单切片发布。
- 不需要数据库迁移。
- 不需要新增后端配置。
- 依赖现有 Worker 和控制面本地开发配置。

回滚方式：

- 回滚前端静态制品或恢复发送按钮禁用状态。
- 后端只读诊断接口和 Worker 不随本切片改变，回滚不会影响现有 runbook 和后端测试。

## 验收标准

- Agent 工作区发送按钮可在候选 Skill 可用时触发现有 `node-health-read@1.1.0`。
- 页面展示服务端返回的强类型事件序列。
- 页面展示 Worker 输出的节点健康结果。
- 失败、拒绝和契约错误均有明确状态。
- 前端不直接调用 Worker，不做授权决策，不解析展示文本判断安全状态。
- 不启用 AgentRuntime，不新增生产写执行或任意脚本执行。
- 相关前端测试、静态检查和浏览器验收通过。
