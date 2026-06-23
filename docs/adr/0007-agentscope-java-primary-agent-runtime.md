# ADR 0007：AgentScope Java 作为 P1 只读诊断主链路

- 状态：Accepted
- 日期：2026-06-13
- 更新日期：2026-06-23
- 负责人：架构负责人
- 相关模块：M01、M02、M03、M04、M05、M07、M08、M09、M10、M11
- 相关任务：AgentScope Java 主运行时接入

## 背景

P1 只读诊断 MVP 已具备身份认证、服务端策略、Skill 注册、只读工作流、受限 Worker 和语义事件的基础闭环。早期方案将 AgentScope Java 作为 M04 主 Agent Runtime 的候选实现接入，用于验证意图理解、计划生成、只读 Tool 调用循环、多步诊断编排和最终诊断摘要。

现在项目需要收敛主链路：P1 只读诊断的产品主路径应由 AgentScope Java 主导 Agent 循环，而不是继续以确定性单 Skill 路由作为主要诊断体验。确定性单 Skill 只读入口保留为兼容、联调和回退路径。

该调整不改变产品边界：系统仍是公司内部自研自用、单组织部署；P1 仍只允许只读诊断；生产写执行、任意脚本执行和审批绕过仍禁止。

## 决策

将 AgentScope Java 定义为 P1 只读诊断主链路中的 M04 主 Agent Runtime。

P1 主链路为：

```text
操作员诊断请求
  -> M01 身份认证和可信身份上下文
  -> M02 服务端策略授权和审计预记录
  -> M05 创建持久化 Agent workflow
  -> M04 AgentScope Java 主运行时理解意图并生成可审计计划摘要
  -> M03 生成已发布、已签名、只读、工作空间可见的 Tool Catalog
  -> M04 AgentScope Java 选择下一次只读 Tool Call
  -> M05 持久化 Tool Step、幂等键、参数哈希、策略引用和事件序列
  -> M07 受限 Worker 执行已授权请求
  -> M08 目标系统只读适配器返回结构化结果
  -> M04 AgentScope Java 读取 Tool Result 并决定继续或结束
  -> M09 输出强类型语义事件和最终摘要
  -> M10 记录指标、日志、追踪和审计证据
```

AgentScope Java 负责：

1. 理解操作员的只读诊断意图。
2. 基于平台提供的 Tool Catalog 生成可审计计划摘要。
3. 在一次 Agent workflow 中选择一个或多个只读 Tool。
4. 读取 Tool Result 并决定是否继续诊断。
5. 输出最终诊断摘要和结构化结果。

平台继续负责：

1. M01 身份认证和可信身份上下文。
2. M02 策略授权、拒绝和审计。
3. M03 Skill 契约、目录式 Skill 包、版本、签名、发布状态和工作空间可见性。
4. M05 workflow 事实源、Tool Step、幂等、状态恢复和事件序列。
5. M07 Worker 隔离执行和 M08 目标系统适配器。
6. M09 强类型语义事件展示。
7. M10 结构化日志、指标、追踪和审计留存。

## AgentScope Skill 与平台契约分离

已有内置 Skill 分为两个目录层次，分别服务不同消费者。

`backend/skills` 面向 AgentScope Java 文件系统 Skill Repository。每个 Skill 目录必须以 `SKILL.md` 作为入口：

```text
backend/skills/<skill-slug>/
|-- SKILL.md
|-- references/   # 可选
|-- examples/     # 可选
`-- scripts/      # 可选，P1 不使用
```

`SKILL.md` 必须包含 AgentScope 可解析的 YAML frontmatter，至少提供 `name` 和 `description`。正文必须用自然语言说明：

1. 什么时候使用该 Skill。
2. 需要哪些输入。
3. 应调用哪个平台 Tool。
4. 如何解释平台 Tool 输出。
5. 必须遵守哪些只读、安全和审计边界。

平台治理 JSON 不放在 `backend/skills`。M03 注册中心、发布签名、输入输出 Schema 和 M11 测试样例统一放在：

```text
backend/contracts/skills/packages/<skill-slug>/
|-- manifest.json
|-- manifest.signature.json
|-- input.schema.json
|-- output.schema.json
`-- tests/
    |-- happy-path.json
    |-- invalid-parameters.json
    `-- policy-denied.json
```

平台契约目录的职责如下：

- `manifest.json`：作为 M03 注册入口，声明责任人、版本、分类、风险、执行器、权限、超时、参数和治理拦截器。
- `manifest.signature.json`：保存 manifest 摘要和发布签名。
- `input.schema.json`：定义 AgentScope Tool Call 和平台命令边界可接受的输入。
- `output.schema.json`：定义 Worker / 适配器返回给 AgentScope 和 M09 的结构化输出。
- `tests/*.json`：保存正常路径、参数拒绝和授权拒绝样例，供 M11 后续接入契约测试与评测。

首批按 AgentScope Skill + 平台契约分离方式重新定义的已有 Skill：

1. `node-health`
2. `application-log-summary`
3. `certificate-expiry`
4. `platform-alert-summary`
5. `service-dependency-health`

## 强约束

- AgentScope Java 不能授予权限。
- AgentScope Java 不能直接访问目标系统。
- AgentScope Java 不能直接执行脚本或本地命令。
- AgentScope Java 不能绕过 M05 workflow 持久化。
- AgentScope Java 不能把 memory、session、plan 或 chat history 作为执行事实源。
- AgentScope Java Tool Catalog 只能来自 M03 已发布 Skill，并经过工作空间、风险等级和策略过滤。
- P1 阶段只允许 `READ_ONLY` Skill。
- 每一次 Tool Call 都必须形成强类型 `AgentToolCall` 或等价平台命令记录，并带有 Skill 版本、参数哈希、策略引用、工作空间、操作员和 trace 上下文。
- 模型内部推理过程不得写入日志、事件、审计或制品。
- 目录式 Skill 包中的 schema、样例和 README 不得包含密钥、生产数据或可执行脚本。

## 考虑过的备选方案

### 继续使用确定性单 Skill 路由作为主链路

优点是安全边界简单，且与早期 P1 实现一致。缺点是无法满足多步诊断、跨 Skill 归纳和基于 Tool Result 继续推理的目标，因此不再作为产品主链路。

### 将 AgentScope Java 作为辅助路由建议器

该方案可以降低初始风险，但会让平台仍以确定性路由为中心，Agent 运行时价值较小，不能满足“AgentScope 做主链路”的目标。

### 让 AgentScope Java 直接执行工具

拒绝采用。直接执行会绕过 M02、M03、M05 和 M07，违反本项目不可妥协的安全规则。

## 影响

正面影响：

- P1 诊断能力从单 Skill 调用扩展为受控多步 Agent 诊断。
- Agent Runtime 与平台安全边界分离，后续可替换模型或运行时。
- 语义事件可以展示计划、工具调用、拒绝和最终摘要。
- Skill 包从注册清单升级为可评审、可测试、可追溯的目录式资产。

负面影响：

- M05 必须把 Agent workflow 和 Tool Step 作为 P1 主路径维护。
- M11 必须把目录式 Skill 包、Tool Catalog、模型行为、安全拒绝和恢复评测纳入门禁。
- 当前接入版本为 AgentScope Java `1.0.12`，后续升级仍需版本稳定性、许可证和传递依赖审查。
- 确定性单 Skill 入口从主路径降级为兼容和回退路径后，操作台与运行手册需要明确入口差异。

## 验证方式

- 契约测试覆盖 Agent Task、Agent Tool Call、Agent Tool Result 和新增语义事件。
- 单元测试覆盖只读 Tool Catalog、未发布 Skill 拒绝、非只读 Skill 拒绝、跨工作空间拒绝。
- Skill 检查覆盖两类目录：AgentScope 目录必须包含可解析的 `SKILL.md`；平台契约目录必须包含 `manifest.json`、`manifest.signature.json`、`input.schema.json`、`output.schema.json` 和三类测试样例。
- 工作流测试覆盖 Agent workflow 幂等、Tool Step 顺序、Agent Runtime 失败和恢复事件。
- 集成测试覆盖 `/api/v1/agent/diagnostics` 的认证、授权和受控只读诊断路径。
- 评测覆盖 Prompt 注入、Tool 输出注入、写操作请求、模型超时和输出格式错误。

## 发布与回滚

AgentScope Java 是 P1 只读诊断的产品主链路，但环境启用仍必须受配置控制。未配置模型提供方、API Key 或评测环境时，控制面必须明确返回不可用状态，不得静默改走未审计路径。

确定性单 Skill 只读入口保留为兼容、联调和紧急回退路径。若 AgentScope 主链路出现异常，可以通过配置关闭 Agent Runtime，并临时回到现有 `/internal/diagnostics/read-only` 单 Skill 只读闭环。历史 Agent workflow、Tool Step、语义事件和审计记录仍需可查询，不得删除或篡改。
