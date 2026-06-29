# P1 SQL 工作台 H2 本地 Smoke 流程

本流程仅用于本地开发和验收 SQL 工作台链路，不代表生产连接配置。

## 控制面与 Worker 预置绑定

本地控制面 H2 启动脚本会预置一个 SQL 工作台连接，Worker 配置也预置了同名 H2 测试绑定：

- `connection-id`: `h2-local-test`
- `target-environment`: `test`
- `platform-type`: `H2`
- `host`: `localhost`
- `port`: `9092`
- `credential-alias`: `h2-local-readonly`
- `schema`: `PUBLIC`

该连接仍必须经过控制面连接目录、Worker 本地连接目录和 host/port allowlist 校验。H2 本地连接不读取真实数据库密码。

## 页面验证步骤

1. 启动控制面和 Worker 后打开 `/sql`。
2. 连接列表应直接包含 `h2-local-test`，目标环境为 `test`，状态为 `READY`。
3. 如本地库中已经手工创建同名连接，启动脚本不会重复插入，也不会覆盖已有元数据。
4. 选择 `h2-local-test` 后输入并校验以下只读 SQL：

```sql
select ORDER_ID, STATUS from PUBLIC.ORDERS order by ORDER_ID
```

5. 点击“执行 SELECT”，结果应返回两行，`STATUS` 分别为 `READY` 和 `PENDING`。

## 禁止事项

- 不得把该 H2 smoke 连接扩展为生产数据库连接。
- 不得在页面、源码、日志或测试数据中写入真实数据库密码、令牌或完整 JDBC URL。
- 不得借本地 H2 验证开放 P1 禁止的 DML 写执行能力。
