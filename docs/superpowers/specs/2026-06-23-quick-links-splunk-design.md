# Claim 系统 Splunk 日志快捷检索设计

> 暂缓实施：短期内 Quick Links / 快捷连接入口和能力保持禁用。后续若重新启用，本设计必须先补齐后端契约、服务端策略授权和审计切片，并重新评审是否仍适用。

## 1. 背景

`frontend/operator-console` 当前已有“快捷连接”预留入口。该入口用于帮助操作员快速进入公司内部其他系统。Splunk 在本设计中只服务于 Claim 系统的测试环境和生产环境日志检索，不作为 ops-agent 自身诊断工作流的一部分。

本设计聚焦 Claim 系统日志检索场景：操作员在快捷连接页选择 Claim 日志模板，填写或选择业务检索条件，由控制面生成受控 Splunk 搜索 URL，并在浏览器中打开 Splunk。该能力只做只读日志检索，不修改 Claim 系统、Splunk 或任何生产数据。

## 2. 设计目标

- 为 Claim 系统测试环境和生产环境提供 Splunk 日志快捷检索入口。
- 支持按 Claim 业务字段预填或填写检索条件，例如 claimNo、policyNo、customerId、requestId、traceId、服务名、环境、时间范围和日志级别。
- 支持团队级共享模板和个人常用参数预设。
- 在打开 Splunk 前展示启动确认页，允许操作员修改模板允许覆盖的字段。
- 由控制面生成最终 Splunk URL，前端不自行拼接目标 URL。
- 记录可审计的启动证据，包括操作者、模板版本、环境、参数摘要和目标 URL 哈希。
- 不读取浏览器保存的密码，不复制 Splunk Cookie，不绕过 Splunk 自身认证和权限。

## 3. 非目标

- 不把 Splunk 接入 ops-agent 的 Agent 工作区、工作流事件、审计详情或 SQL 预检结果。
- 不从 ops-agent 诊断上下文自动推导 Splunk 检索条件。
- 不建设通用外部系统自动登录平台。
- 不读取或托管浏览器保存的个人密码。
- 不复制、注入或共享目标系统 Cookie。
- 不提供浏览器扩展、本地助手或自动点击登录能力。
- 不做个人凭据金库。
- 不在本设计中接入堡垒机、监控平台或其他目标系统。
- 不允许通过该入口执行生产写操作、脚本执行或绕过审批。

## 4. 已确认决策

### 4.1 目标系统范围

MVP 只做 Claim 系统的 Splunk 日志检索。测试环境和生产环境都可支持，但必须在模板、参数、审计和权限中明确区分环境。

### 4.2 Splunk 打通深度

采用“Splunk 搜索深链 + 启动确认页”方案：

1. 操作员进入快捷连接页。
2. 操作员选择 Claim 系统日志模板。
3. 操作员填写或选择业务检索条件。
4. 控制面按 Splunk 搜索模板生成确认模型。
5. 操作员确认或修改允许覆盖的字段。
6. 控制面写启动审计并返回已编码 Splunk URL。
7. 浏览器打开 Splunk 新标签页。
8. 如果用户已有 Splunk session，则直接进入搜索；如果没有，由 Splunk 登录页接管，浏览器可使用自己的自动填充能力。

### 4.3 凭据与会话边界

Splunk 使用操作员个人凭据，但本系统不读取、不保存、不转发个人凭据。浏览器是否能自动填充 Splunk 登录表单，由浏览器和 Splunk 登录页自行处理。本系统只负责生成受控启动 URL 和审计启动动作。

### 4.4 配置权限分层

采用三层配置：

- 平台管理员维护 Splunk 适配器，包括基础 URL、允许域名、允许路径、认证模式、允许参数、参数编码规则、审计字段和风险级别。
- 团队管理员维护 Claim 系统共享搜索模板，例如“Claim 号日志检索”“保单号链路检索”“客户号错误日志”“requestId 追踪”。
- 操作员维护个人收藏和个人参数预设，例如默认环境、默认时间窗口、常用日志级别、常用服务名。

### 4.5 参数来源

参数来源以 Claim 业务检索表单和个人预设为主。系统可以根据模板默认值预填环境、时间范围、服务名和日志级别，但不得从 ops-agent 工作流或 Agent 诊断上下文推导 Claim 检索条件。

## 5. 模块归属

本设计主要落在 M09，同时依赖 M01、M02 和 M10：

- M09：快捷连接页、启动确认页和强类型响应渲染。
- M01：确认操作员身份和浏览器会话。
- M02：判断操作员是否可使用某个 Splunk 模板，尤其是生产环境模板，并记录授权/拒绝审计。
- M10：提供结构化审计、指标和可观测性要求。

该能力不引入新的独立服务，不直接调用 Claim 系统或 Splunk API，也不改变单组织部署边界。

## 6. 核心对象

### 6.1 Splunk 适配器

平台级配置，描述一个受控 Splunk 目标系统。

建议字段：

- `adapterId`
- `displayName`
- `targetType = SPLUNK`
- `authMode = BROWSER_SESSION`
- `baseUrl`
- `allowedHosts`
- `allowedPaths`
- `allowedParameters`
- `parameterEncoding`
- `redactionRules`
- `riskLevel = READ_ONLY`
- `enabled`
- `version`

### 6.2 Claim 日志搜索模板

团队级配置，描述一种 Claim 系统日志检索场景。

建议字段：

- `templateId`
- `adapterId`
- `displayName`
- `description`
- `ownerTeam`
- `claimEnvironment`
- `queryPattern`
- `requiredFields`
- `optionalFields`
- `userEditableFields`
- `defaultTimeRange`
- `defaultIndex`
- `defaultSourceType`
- `version`
- `status`

模板不得保存密码、Cookie、Token 或其他目标系统凭据。

### 6.3 Claim 检索条件

由快捷连接页表单或个人预设传入，必须按 Schema 校验。

建议字段：

- `claimNo`
- `policyNo`
- `customerId`
- `requestId`
- `traceId`
- `serviceName`
- `claimEnvironment`
- `timeRange`
- `logLevel`
- `keyword`

同一模板可以要求不同字段。例如“Claim 号日志检索”要求 `claimNo` 和 `claimEnvironment`，“requestId 追踪”要求 `requestId` 和 `timeRange`。

### 6.4 启动确认模型

后端返回给前端渲染，前端不得自行推断安全状态。

建议字段：

- `launchRequestId`
- `adapterSummary`
- `templateSummary`
- `claimSearchSummary`
- `resolvedParameters`
- `editableFields`
- `missingFields`
- `warnings`
- `auditSummary`

### 6.5 启动结果

确认后后端写审计并返回启动结果。

建议字段：

- `launchId`
- `targetUrl`
- `targetUrlHash`
- `auditEventId`
- `expiresAt`

## 7. 页面交互

### 7.1 快捷连接页

快捷连接页展示 Claim 系统 Splunk 日志模板目录、个人收藏和最近启动记录。操作员可以按环境、模板类型、服务名或收藏筛选入口。

页面应明确区分测试环境和生产环境。生产环境模板需要更醒目的环境标识，并展示启动审计说明。

### 7.2 检索条件表单

操作员选择模板后进入检索条件表单。表单字段由模板 Schema 决定，支持必填字段、可选字段、默认值和字段级校验。

常见字段包括：

- Claim 号。
- 保单号。
- 客户号。
- requestId。
- traceId。
- 服务名。
- 测试或生产环境。
- 时间范围。
- 日志级别。
- 关键字。

### 7.3 启动确认页

启动确认页展示目标系统、模板名称、Claim 检索摘要、环境、查询摘要、时间范围和审计说明。操作员只能修改模板声明为可覆盖的字段。

确认页必须明确说明：系统将打开 Splunk 页面；如果 Splunk 未登录，需要在 Splunk 页面完成登录。

## 8. 数据流

```text
快捷连接页
  -> 选择 Claim 系统 Splunk 模板
  -> 填写或选择 Claim 检索条件
  -> 控制面校验身份、策略、模板、参数
  -> 返回启动确认模型
  -> 操作员确认或补齐字段
  -> 控制面再次校验并写启动审计
  -> 返回已编码 Splunk URL
  -> 浏览器打开新标签页
  -> Splunk 复用自身 session 或展示登录页
```

前端只负责提交结构化检索条件和渲染后端响应。最终 URL 必须由控制面生成。

## 9. 安全规则

- 目标 URL 只能指向适配器白名单中的 Splunk host 和 path。
- URL 参数必须经过模板 Schema 校验和编码。
- Claim 号、保单号、客户号、requestId、traceId、关键字等字段均视为不可信输入。
- 前端不得根据展示文本判断权限或启动状态。
- 生产环境模板必须经过服务端策略判断。
- 审计写入失败时不得启动。
- 审计记录不得保存密码、Cookie 或完整敏感 URL。
- 审计记录保存目标 URL 哈希、模板版本和脱敏后的参数摘要。
- 参数摘要必须按 `redactionRules` 脱敏，尤其是客户号等可能包含敏感信息的字段。
- 该入口不得成为生产写操作、脚本执行、审批绕过或目标系统权限绕过路径。

## 10. 错误处理

- 未登录本系统：跳转本系统登录页。
- 无权使用模板：显示服务端拒绝原因和审计编号。
- 无权使用生产环境模板：显示生产环境访问受限说明和审计编号。
- 检索条件缺必填字段：确认页展示缺失字段并允许补齐。
- 参数不合法：后端返回字段级错误，前端不生成跳转。
- Splunk 未登录：正常打开 Splunk 登录页，由用户完成登录。
- Splunk URL 配置异常：阻止启动，提示联系平台管理员。
- 审计写入失败：阻止启动，避免出现不可追踪入口。
- 目标系统打开失败：前端只能提示已生成启动链接，不能伪造 Splunk 执行结果。

## 11. 可观测性与审计

每次启动尝试至少记录：

- `operatorId`
- `templateId`
- `templateVersion`
- `adapterId`
- `adapterVersion`
- `claimEnvironment`
- `parameterSummary`
- `targetUrlHash`
- `policyDecision`
- `auditEventId`
- `traceId`
- `timestamp`

建议指标：

- 启动确认模型生成次数。
- 启动确认成功次数。
- 测试环境启动次数。
- 生产环境启动次数。
- 策略拒绝次数。
- 参数校验失败次数。
- 审计写入失败次数。
- 各模板启动次数。

## 12. 测试验收

### 12.1 契约测试

- 模板列表响应、确认模型响应、启动响应和拒绝响应均由 Schema 校验。
- 缺失字段、字段级错误和脱敏摘要均有固定契约。

### 12.2 权限测试

- 普通操作员只能看到服务端授权的模板。
- 生产环境模板必须按服务端策略判断。
- 团队管理员可以维护 Claim 共享模板。
- 平台管理员可以维护 Splunk 适配器。
- 无权限用户无法生成确认模型或启动 URL。

### 12.3 安全测试

- 恶意 host 被拒绝。
- 非白名单 path 被拒绝。
- 开放重定向被拒绝。
- 参数注入被编码或拒绝。
- 前端无法读取浏览器密码、Splunk Cookie 或目标系统 session。
- 审计失败时不得返回可打开 URL。
- 客户号等敏感字段在审计摘要中脱敏。

### 12.4 前端测试

- 快捷连接页展示 Claim 系统 Splunk 模板、收藏和最近启动记录。
- 测试环境和生产环境有清晰视觉区分。
- 检索条件表单按模板 Schema 渲染字段。
- 启动确认页展示预填参数、缺失字段和可编辑字段。
- 字段级错误能准确落到对应输入控件。
- 确认成功后使用后端返回 URL 打开新标签页。

### 12.5 浏览器验收

- 从快捷连接页选择 Claim 系统 Splunk 模板。
- 填写 Claim 号或 requestId、环境和时间范围。
- 确认页允许修改时间范围和关键字。
- 确认后打开 Splunk URL。
- 未登录 Splunk 时进入 Splunk 登录页；已登录时进入搜索页。

## 13. 发布与回滚

发布影响：

- 新增 Claim 系统 Splunk 日志只读检索入口。
- 新增操作台页面和控制面启动契约。
- 新增审计事件类型或审计动作分类。

回滚方式：

- 关闭 Splunk 适配器配置或隐藏快捷连接入口。
- 回退前端快捷连接页面和控制面启动接口。
- 保留已产生的审计记录，不删除历史证据。

## 14. 后续扩展

后续目标系统应复用适配器模型，但需要逐个评审：

- 堡垒机：优先使用 SSO 深链和资产上下文，不托管凭据。
- 监控平台：优先使用服务、环境、时间窗口生成看板深链。
- SQL/AS400 工具：必须继续遵守 P1 只读和 DML 预检边界。
- 如需浏览器扩展、本地助手或个人凭据金库，必须单独编写安全设计和 ADR。
