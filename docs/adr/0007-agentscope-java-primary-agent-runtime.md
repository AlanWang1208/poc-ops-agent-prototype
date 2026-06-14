# ADR 0007：AgentScope Java 主 Agent Runtime 接入边界

- 状态：Accepted
- 日期：2026-06-13
- 负责人：架构负责人
- 相关模块：M03、M04、M05、M07、M08、M09、M10、M11
- 相关任务：AgentScope Java 主运行时 POC

## 背景

P1 只读诊断 MVP 已具备身份认证、服务端策略、Skill 注册、只读工作流、受限 Worker 和语义事件的基础闭环。现需评估并接入 AgentScope Java，使其承担主 Agent Runtime 职责，而不是仅作为候选路由的辅助建议器。

主运行时接入后，AgentScope Java 将负责意图理解、计划生成、只读 Tool 调用循环、多步诊断编排和最终诊断摘要。由于该职责位于模型与工具执行之间，必须明确平台安全边界，避免模型运行时替代授权、审计、工作流事实源或 Worker 隔离。

## 决策

将 AgentScope Java 作为 M04 的主 Agent Runtime 候选接入 P1 只读诊断 MVP。

AgentScope Java 负责：

1. 理解操作员的只读诊断意图。
2. 基于平台提供的只读 Tool Catalog 生成可审计计划摘要。
3. 在一次 Agent 任务中选择一个或多个只读 Tool。
4. 读取 Tool 结果并决定是否继续诊断。
5. 输出最终诊断摘要和结构化结果。

平台继续负责：

1. M01 身份认证和可信身份上下文。
2. M02 策略授权、拒绝和审计。
3. M03 Skill 契约、版本、签名、发布状态和工作空间可见性。
4. M05 工作流事实源、幂等、状态恢复和事件序列。
5. M07 Worker 隔离执行和 M08 目标系统适配器。
6. M09 强类型语义事件展示。
7. M10 结构化日志、指标、追踪和审计留存。

## 强约束

- AgentScope Java 不能授予权限。
- AgentScope Java 不能直接访问目标系统。
- AgentScope Java 不能直接执行脚本或本地命令。
- AgentScope Java 不能绕过 M05 工作流持久化。
- AgentScope Java 不能把 memory、session、plan 或 chat history 作为执行事实源。
- AgentScope Java Tool Catalog 只能来自 M03 已发布 Skill，并经过工作空间、风险等级和策略过滤。
- P1 阶段只允许 `READ_ONLY` Skill。
- 每一次 Tool Call 都必须形成强类型 `AgentToolCall`，并带有 Skill 版本、参数哈希、策略引用、工作空间、操作员和 trace 上下文。
- 模型内部推理过程不得写入日志、事件、审计或制品。

## 考虑过的备选方案

### 继续使用确定性单 Skill 路由

优点是安全边界简单，且与当前 P1 实现一致。缺点是难以表达多步诊断、跨 Skill 归纳和基于工具结果的后续判断。

### 将 AgentScope Java 作为辅助路由建议器

该方案可以降低初始风险，但不能满足“AgentScope 做主力”的目标。它会让平台仍以确定性路由为中心，Agent 运行时价值较小。

### 让 AgentScope Java 直接执行工具

拒绝采用。直接执行会绕过 M02、M03、M05 和 M07，违反本项目不可妥协的安全规则。

## 影响

正面影响：

- P1 诊断能力从单 Skill 调用扩展为受控多步 Agent 诊断。
- Agent Runtime 与平台安全边界分离，后续可替换模型或运行时。
- 语义事件可以展示计划、工具调用、拒绝和最终摘要。

负面影响：

- M05 需要新增 Agent 工作流和 Tool Step 持久化。
- M11 需要新增模型行为、安全拒绝和恢复评测。
- 当前接入版本为 AgentScope Java `1.0.12`，后续升级仍需版本稳定性、许可证和传递依赖审查。

## 验证方式

- 契约测试覆盖 Agent Task、Agent Tool Call、Agent Tool Result 和新增语义事件。
- 单元测试覆盖默认关闭、只读 Tool Catalog、未发布 Skill 拒绝、非只读 Skill 拒绝、跨工作空间拒绝。
- 工作流测试覆盖 Agent workflow 幂等、Tool Step 顺序、Agent Runtime 失败和恢复事件。
- 集成测试覆盖 `/api/v1/agent/diagnostics` 的认证、授权、默认关闭和受控只读诊断路径。
- 评测覆盖 Prompt 注入、Tool 输出注入、写操作请求、模型超时和输出格式错误。

## 发布与回滚

首期通过 `ops-agent.agent-runtime.enabled=false` 默认关闭。

启用后仅允许在开发或评测环境运行。若 Agent Runtime 出现异常，关闭开关后控制面必须回到现有 `/internal/diagnostics/read-only` 单 Skill 只读闭环。历史 Agent workflow 和审计记录仍需可查询，不得删除或篡改。
