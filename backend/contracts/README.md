# 契约

本目录保存版本化跨模块契约。

计划中的契约类型：

- `api`：OpenAPI 和 API Schema。
- `api/identity`：内建身份提供方与浏览器登录相关的 API 契约。
- `events`：语义事件 Schema。
- `skills`：平台 Skill 元数据、发布签名、输入输出 Schema 和测试样例；与 `backend/skills/<skill>/SKILL.md` 通过相同 Skill / Tool 名称关联。
- `workflow`：工作流、审批和执行命令 Schema。

提供方和消费方实现合入前，契约必须完成评审和兼容性测试。
