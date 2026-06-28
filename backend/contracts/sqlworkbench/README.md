# SQL 工作台契约

本目录保存 SQL 工作台跨控制面、Worker 和操作台使用的版本化契约。

P1 契约只允许开发与测试环境。`RUN_READ_ONLY` 只能执行只读查询，DML 仅允许通过
`PREFLIGHT_DML` 生成预检报告，不得进入执行信封。

AI SQL 助手契约只用于生成解释、优化和错误分析建议。助手请求不得包含密钥、JDBC URL
或结果行；助手响应必须标记 `validationRequired=true`，建议 SQL 只能由操作员显式应用回
编辑器，并重新进入服务端校验和策略链路。
