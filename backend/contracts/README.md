# 契约

本目录保存版本化跨模块契约。

计划中的契约类型：

- `api`：OpenAPI 和 API Schema。
- `api/identity`：内建身份提供方与浏览器登录相关的 API 契约。
- `events`：语义事件 Schema。
- `skills`：与 `backend/skills` 对应的 Skill 元数据以及输入输出 Schema。
- `workflow`：工作流、审批和执行命令 Schema。

提供方和消费方实现合入前，契约必须完成评审和兼容性测试。

## Team Workspace v2 契约

Team Workspace 定制闭环新增 v2 契约：

- `api/identity/identity-session-status-response-v2.schema.json`
- `workflow/read-only-command-v2.schema.json`
- `workflow/worker-execution-request-v2.schema.json`
- `workflow/worker-execution-result-v2.schema.json`
- `events/semantic-event-v2.schema.json`

v1 契约保留为历史只读路径；新增实现必须优先使用 v2 契约携带 `workspaceId` 或 `workspace` 上下文。
