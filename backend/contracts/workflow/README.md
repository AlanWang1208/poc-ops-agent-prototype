# 工作流契约

本目录保存工作流、审批、执行命令、结果、补偿和人工接管 Schema。

命令必须绑定身份、目标、Skill 版本、参数、幂等键、策略决策、必要的审批引用以及链路追踪上下文。

P1 已版本化契约：

- `read-only-command-v1.schema.json`：控制面生成的已授权只读命令信封。
- `worker-execution-request-v1.schema.json`：发送到受限 Worker 的短期执行请求。
- `worker-execution-result-v1.schema.json`：Worker 返回的强类型结果。

P1 契约将 `operationClass` 固定为 `READ_ONLY`，不得用于生产写操作。
