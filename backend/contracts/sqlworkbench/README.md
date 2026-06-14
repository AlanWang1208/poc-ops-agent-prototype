# SQL 工作台契约

本目录保存 SQL 工作台跨控制面、Worker 和操作台使用的版本化契约。

P1 契约只允许开发与测试环境。`RUN_READ_ONLY` 只能执行只读查询，DML 仅允许通过
`PREFLIGHT_DML` 生成预检报告，不得进入执行信封。
