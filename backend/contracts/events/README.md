# 事件契约

本目录保存语义事件和审计事件 Schema。

每个语义事件必须包含：

- `eventId`
- `workflowId`
- `sequence`
- `timestamp`
- `type`
- 强类型 `payload`

禁止发布模型内部推理过程。

`semantic-event-v1.schema.json` 定义 P1 操作台消费的版本化语义事件及强类型载荷。

`semantic-event-v2.schema.json` 在顶层增加 `workspaceId`，操作台恢复和去重必须按 `workspaceId + workflowId + sequence` 处理。
