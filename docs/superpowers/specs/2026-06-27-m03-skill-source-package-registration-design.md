# M03 Skill 源包注册闭环设计

- 日期：2026-06-27
- 相关模块：M03、M04、M07、M08、M09、M11
- 目标阶段：P1 只读诊断 MVP
- 任务切片：M03 Skill 注册中心源包到契约包闭环
- 状态：已确认设计，待实现计划
- 设计结论：P1 采用“开发者目录源包 + 工具生成平台注册契约包”的方式闭合 Skill 注册流程。开发者只维护符合 AgentScope Java 文件系统 Skill 规范的 `SKILL.md`、Ops Agent 私有的 `skill.package.yaml` 和可选样例；工具生成 `backend/contracts/skills/packages/<skill>/` 下的 Manifest、Schema、测试样例和签名文件。M03 继续扫描生成后的契约包，不提供上传安装、运行时注册、生产写执行或脚本执行。

## 背景

当前 M03 已经具备 Skill Manifest 契约、发布签名文件契约、启动期注册和显式发布校验动作。现有 P1 只读 Skill 已按以下方式维护：

```text
backend/skills/<skill>/
`-- SKILL.md

backend/contracts/skills/packages/<skill>/
|-- manifest.json
|-- manifest.signature.json
|-- input.schema.json
|-- output.schema.json
`-- tests/
    |-- happy-path.json
    |-- invalid-parameters.json
    `-- policy-denied.json
```

这套形态能支撑控制面启动扫描和 M04 候选路由，但从开发者视角还不是一个完整的注册闭环。新增一个 Skill 时，开发者需要理解并手写平台内部产物，包括 Manifest、输入输出 Schema、发布签名和测试样例。这不符合主流 Skill 包体验，也容易造成 AgentScope 入口和平台注册契约漂移。

同时，不能把 Ops Agent 私有治理字段塞进 `SKILL.md`。`SKILL.md` 是 AgentScope Java 的文件系统 Skill 入口，应保持可移植和面向 Agent 的说明性质。如果在其中写入角色、Worker、endpoint、凭据、allowlist、发布状态等平台注册语义，迁移到其他 Agent 宿主时容易造成语义污染，甚至诱导 Agent 尝试绕过宿主平台直接补偿执行。

因此，P1 需要补齐一条简单、可审计、符合当前安全边界的注册闭环：开发者新增目录源包，仓库工具生成平台契约包，CI 校验生成产物未漂移，M03 继续加载受信契约包。

## 目标

- 让开发者新增一个 P1 只读 Skill 时，只需要维护 `backend/skills/<skill>/` 下的源包。
- 保持 `SKILL.md` 符合 AgentScope Java 文件系统 Skill 入口规范，避免混入 Ops Agent 私有注册字段。
- 通过 `skill.package.yaml` 表达 Ops Agent 私有注册元数据，并作为生成平台契约包的唯一来源。
- 由仓库工具生成现有 M03 可扫描的 `manifest.json`、`input.schema.json`、`output.schema.json`、`tests/*.json` 和 `manifest.signature.json`。
- 在 CI 中强制校验源包和生成产物一致，防止只改源包或只改生成产物造成漂移。
- 保持 M03 当前运行时模型：控制面启动扫描 `backend/contracts/skills/packages`，不直接执行 Skill 源包内容。
- 保持 P1 只读边界：只允许 `READ_ONLY` Skill，不开放上传安装、运行时注册、任意脚本执行或生产写操作。

## 非目标

- 不提供操作台上传 zip、上传 JSON、在线安装、在线升级或在线卸载。
- 不提供生产环境运行时注册 API。
- 不让 M03 在 P1 直接扫描 `backend/skills` 源包作为运行时事实源。
- 不把 endpoint、credential、allowlist、外部系统地址或环境配置写入 Skill 源包。
- 不允许 `scripts/` 在 P1 被 AgentScope、控制面或 Worker 执行。
- 不改变 M02 授权、M05 工作流事实源、M07 Worker 隔离和 M10 审计观测边界。
- 不引入多租户、外部客户开放平台、商业化计费或其他设计范围外能力。

## 设计范围追溯

本设计对应 V8.1 和当前规划中的以下能力：

- M03：Skill 契约、版本、签名、注册和发布校验。
- M04：AgentScope Java 主运行链路中的 Tool Catalog 与只读 Skill 路由。
- M07：只通过受限 Worker 执行已授权只读命令，不让 Skill 包携带环境执行能力。
- M08：运维 Skill 以目录包方式维护，简单 HTTP/JSON 只读 Skill 优先复用配置型 Worker 适配器。
- M09：Skill 注册中心页面展示真实目录和不可路由原因，P1 变更类操作保持禁用。
- M11：通过契约校验、生成产物漂移检查和样例测试证明注册链路。

该设计是为实现 Skill 注册和治理目标补充的工程机制，不改变公司内部自研自用、单组织部署的产品边界。

## 方案选择

已确认采用方案 1：开发者目录源包 + 生成平台注册契约包。

```text
开发者新增 backend/skills/<skill-id>/
  -> 编写 SKILL.md
  -> 编写 skill.package.yaml
  -> 运行 tools/skills validate
  -> 运行 tools/skills generate
  -> 生成 backend/contracts/skills/packages/<skill-id>/
  -> CI 校验生成产物未漂移
  -> 控制面启动扫描 contracts 包
  -> M03 注册目录可查
  -> M04 / AgentScope Tool Catalog 可路由
  -> M09 Skill 注册中心可展示
```

不采用 M03 直接扫描源包作为 P1 运行时事实源。这样可以复用现有 M03 加载器、签名校验、发布状态和 M04 路由实现，减少运行时行为变化。源包到契约包的一致性由工具和 CI 门禁保证。

## 源包结构

每个开发者维护的 Skill 源包位于：

```text
backend/skills/<skill-id>/
|-- SKILL.md
|-- skill.package.yaml
|-- schemas/
|   |-- input.schema.json
|   `-- output.schema.json
|-- examples/
|   |-- happy-path.json
|   |-- invalid-parameters.json
|   `-- policy-denied.json
`-- references/
```

`SKILL.md` 是 AgentScope Java 标准入口。它只描述 Agent 何时使用该 Skill、需要哪些输入、如何解释输出以及必须遵守的只读安全边界。

`skill.package.yaml` 是 Ops Agent 私有注册源。它不面向 AgentScope 泛用宿主，而是用于生成 M03 平台契约包。

`schemas/`、`examples/` 和 `references/` 为可选目录。`schemas/` 用于保存源包输入输出 Schema，工具会复制到生成契约包；缺省时工具可以按参数生成最小输入 Schema 和通用输出 Schema。`examples/` 用于生成或校验平台测试样例，`references/` 用于保存补充说明。P1 禁止 `scripts/`，如果源包内存在 `scripts/` 目录或脚本执行声明，校验必须失败。

## SKILL.md 规范

`SKILL.md` 必须保留 AgentScope Java 文件系统 Skill 入口的简洁形态：

```yaml
---
name: weather-current-read
description: Read the current weather for a specified location through a host-provided read-only tool.
---
```

正文应包含：

- 适用场景。
- 必要输入。
- 输出解释方式。
- 只读安全边界。
- 不直接访问目标系统、不使用未托管凭据、不执行脚本、不绕过宿主平台 Tool。

正文不得包含：

- Ops Agent 角色或 RBAC 规则。
- Worker 配置、endpoint、allowlist 或 credential。
- 平台发布状态、签名、灰度、回滚或审计实现细节。
- 环境专用主机名、密钥、生产数据或未脱敏日志。

`SKILL.md` 可以使用“宿主平台提供的受控只读 Tool”这类通用表达，但不应要求 Agent 在缺少平台 Tool 时自行调用外部 API、读取环境变量、执行本地命令或编造结果。

## skill.package.yaml 规范

`skill.package.yaml` 是平台生成契约包的唯一结构化来源。P1 最小结构如下：

```yaml
schemaVersion: ops-agent.skill/v1
skillId: weather-current-read
version: 1.0.0
displayName: 当前天气查询
description: 读取指定地点的当前天气、温度、湿度和风速摘要。
category: PLATFORM_OBSERVABILITY
riskLevel: READ_ONLY
readOnly: true
executor: HTTP
outputType: JSON
owner: platform-observability
requiredRoles:
  - ROLE_ops-reader
  - ROLE_ops-admin
timeoutSeconds: 15
interceptors:
  - AUTHORIZATION
  - AUDIT
  - SENSITIVE_DATA_MASKING
tags:
  - weather
  - current
  - environment
parameters:
  - name: location
    displayName: 地点
    description: 需要查询当前天气的城市、站点或地理位置。
    type: STRING
    required: true
    allowedValues: []
    defaultValue: null
```

禁止字段包括：

- `endpointUrl`
- `apiKey`
- `credentialRef`
- `allowlist`
- `script`
- `command`
- `shell`
- 其他会把环境执行能力、凭据或脚本逻辑放入 Skill 源包的字段

真实 endpoint、HTTP 出口 allowlist、凭据别名和环境差异属于 M07 Worker 环境配置或后续受控凭据机制，不属于 Skill 源包。

## 一致性校验

源包校验必须强制执行以下规则：

- `SKILL.md` 必须存在。
- `SKILL.md` frontmatter 必须包含 `name` 和 `description`。
- `skill.package.yaml` 必须存在，并符合 `tools/skills/skill-package.schema.json`。
- `SKILL.md` frontmatter `name` 必须等于 `skill.package.yaml.skillId`。
- `SKILL.md` frontmatter `description` 不得与 `skill.package.yaml.description` 表达冲突。
- 目录名应为稳定包名，可以不等于 `skillId`，但推荐去掉 `-read` 后保持一致，例如 `weather-current` 对应 `weather-current-read`。
- `readOnly` 必须为 `true`。
- `riskLevel` 必须为 `READ_ONLY`。
- `parameters` 中的名称、类型、必填项、枚举值和默认值必须合法。
- 如果存在 `examples/`，样例参数必须能通过生成的输入契约校验。
- 如果存在 `scripts/` 或禁止字段，校验失败。

## 生成工具

新增仓库工具目录：

```text
tools/skills/
|-- README.md
|-- skill-package.schema.json
`-- skill-package-tool
```

工具命令：

```bash
tools/skills/skill-package-tool validate backend/skills/weather-current
tools/skills/skill-package-tool generate backend/skills/weather-current
tools/skills/skill-package-tool validate-all
tools/skills/skill-package-tool generate-all --check
```

`validate` 只校验源包，不写文件。

`generate` 读取源包并生成或覆盖：

```text
backend/contracts/skills/packages/<package-name>/
|-- manifest.json
|-- input.schema.json
|-- output.schema.json
|-- manifest.signature.json
`-- tests/
    |-- happy-path.json
    |-- invalid-parameters.json
    `-- policy-denied.json
```

`validate-all` 扫描所有 `backend/skills/*/skill.package.yaml`。

`generate-all --check` 重新生成到临时目录，并与已提交的 `backend/contracts/skills/packages` 产物比较。如果存在漂移，命令失败并输出需要重新生成的包名和文件名。

## 生成规则

- `manifest.json` 由 `skill.package.yaml` 映射到现有 `skill-manifest.schema.json`。
- `input.schema.json` 和 `output.schema.json` 优先从源包 `schemas/` 复制；缺失时工具按 `parameters` 生成最小输入 Schema，并生成通用 JSON object 输出契约。
- `tests/*.json` 优先由 `examples/*.json` 复制；缺失时生成最小样例骨架并让校验提示开发者补充。
- `manifest.signature.json` 使用仓库当前开发签名机制生成。生产签名方案留到 P2/P3，不在 P1 工具中伪装为正式生产签名。

生成产物仍必须通过现有 contracts 模块测试、M03 加载器校验和发布校验动作。

## CI 门禁

CI 至少新增两个检查：

```bash
tools/skills/skill-package-tool validate-all
tools/skills/skill-package-tool generate-all --check
```

失败条件包括：

- 源包结构不完整。
- `SKILL.md` 与 `skill.package.yaml` 不一致。
- P1 只读约束不成立。
- 存在禁止字段或 `scripts/`。
- 样例无法通过输入契约校验。
- 生成产物与已提交 contracts 包不一致。

该门禁保证仓库事实源可审计：开发者体验上只维护源包，运行时仍只消费已生成、已签名、已校验的契约包。

## M03 运行时行为

M03 P1 运行时保持现状：

- 控制面启动时扫描 `backend/contracts/skills/packages/**/manifest.json`。
- 校验相邻 `manifest.signature.json`。
- 解析 `manifest.json` 为 `RegisteredSkill`。
- 只注册通过摘要和签名校验的条目。
- 对外提供目录查询、版本查询和发布校验回显。

M03 不读取 `SKILL.md` 正文，不解析 `examples/`，不执行源包内任何资源，也不从 `backend/skills` 直接产生运行时注册记录。这样可以避免 Agent 可读说明成为控制面事实源。

## M04 与 AgentScope Tool Catalog

M04 和 AgentScope Tool Catalog 只从 M03 已注册 Skill 生成候选能力。

纳入 Tool Catalog 的 Skill 必须满足：

- `publicationStatus=VALIDATED`
- `readOnly=true`
- `riskLevel=READ_ONLY`
- 未被发布态管理标记为回滚
- 满足路由条件中的分类、参数、标签和上下文约束

Tool Catalog 可以暴露工具名、描述、参数和输出摘要，但不得暴露 endpoint、allowlist、credential 或 Worker 环境配置。AgentScope 只能提出 Tool 调用意图，真实执行必须继续经过 M05 平台守护执行器、M02 授权、M05 Tool Step 持久化、语义事件发布和 M07 Worker 隔离执行。

## M09 展示

Skill 注册中心页面继续消费 M03 真实目录。

P1 页面展示：

- Skill 名称、版本、分类、风险、只读状态。
- 源包路径和生成契约包路径。
- 发布校验状态。
- 参数列表、角色要求、拦截器、标签。
- 路由可用性和不可路由原因，例如未发布、非只读、风险等级不符合、参数不匹配或已回滚。

P1 页面保持禁用：

- 上传
- 安装
- 升级
- 卸载
- 在线编辑
- 写执行发布

页面可以展示注册流程说明和本地生成命令提示，但不得在浏览器中执行注册、写仓库或绕过 CI 门禁。

## 安全边界

- Skill 源包、样例、正文和生成产物都视为不可信输入，工具和 M03 必须显式校验。
- `SKILL.md` 不能降低组织安全基线。
- 模型不能从 `SKILL.md`、examples 或输出文本中获得直接执行权限。
- P1 禁止任意脚本执行。
- P1 禁止生产写执行。
- Skill 包不得包含密钥、生产数据或环境专用凭据引用。
- Worker 仍是执行边界；注册中心只表达能力契约，不持有目标系统长期凭据。
- M02 授权、M05 工作流事实源、M07 Worker 隔离和 M10 审计观测不可被注册工具绕过。

## 测试策略

新增或扩展以下测试：

- `skill.package.yaml` schema 校验测试。
- `SKILL.md` frontmatter 解析测试。
- `SKILL.md.name` 与 `skill.package.yaml.skillId` 不一致的失败测试。
- 非只读 Skill 的失败测试。
- 禁止字段和 `scripts/` 的失败测试。
- 参数生成 `input.schema.json` 的快照或结构测试。
- `generate-all --check` 发现漂移的测试。
- 生成后的 contracts 包继续通过现有 contracts 测试。
- 控制面启动后能查询由源包生成的新 Skill。
- M04 能把生成后的 Skill 作为只读候选返回。
- M09 API/Zod 边界能消费 M03 返回的目录结构。

浏览器验收只需要证明 Skill 注册中心展示真实目录并禁用变更类操作，不需要模拟上传或在线安装。

## 发布与回滚

P1 发布方式：

1. 开发者提交源包和生成后的 contracts 包。
2. CI 校验源包、生成产物和现有 contracts 测试。
3. 控制面部署后启动扫描生成产物。
4. M03 目录中出现新 Skill。

回滚方式：

- 回滚对应 Git 变更，移除源包和生成产物，重新部署控制面。
- 如果仅生成产物有误，CI 应在合入前通过漂移检查阻止。
- P1 不提供生产运行时卸载或回滚按钮。

## 验收标准

- 新增一个符合 AgentScope 目录规范的 `backend/skills/<skill>/` 后，开发者只需要维护 `SKILL.md`、`skill.package.yaml` 和可选 `schemas/`、`examples/`。
- `validate` 能指出缺字段、非只读、禁止字段、`SKILL.md` 与 `skill.package.yaml` 不一致等问题。
- `generate` 能生成现有 M03 可扫描的 contracts 包。
- `generate-all --check` 能在 CI 中发现源包和生成产物漂移。
- 控制面启动后，新 Skill 出现在 M03 目录查询接口中。
- M04 能把新 Skill 作为只读候选返回。
- AgentScope Tool Catalog 能包含该 Skill，但真实执行仍必须经过 M05 和 M07。
- M09 Skill 注册中心能展示该 Skill，并保持上传、安装、升级、卸载和写执行类操作禁用。
- P1 明确拒绝上传安装、运行时注册、脚本执行、endpoint 或 credential 写入 Skill 包。
