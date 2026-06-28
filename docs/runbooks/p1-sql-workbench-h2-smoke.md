# P1 SQL 工作台 H2 本地 Smoke 流程

本流程仅用于本地开发和验收 SQL 工作台链路，不代表生产连接配置。

## Worker 预置绑定

本地 Worker 配置预置了一个 H2 测试连接：

- `connection-id`: `h2-local-test`
- `target-environment`: `test`
- `platform-type`: `H2`
- `host`: `localhost`
- `port`: `9092`
- `credential-alias`: `h2-local-readonly`
- `schema`: `PUBLIC`

该连接仍必须经过控制面连接目录、Worker 本地连接目录和 host/port allowlist 校验。H2 本地连接不读取真实数据库密码。

## 页面验证步骤

1. 打开 `/sql`，点击“新建连接”。
2. 填写连接名称 `h2-local-test`，目标环境选择 `test`，平台类型选择 `H2`。
3. 主机填写 `localhost`，端口填写 `9092`，凭据别名填写 `h2-local-readonly`。
4. 默认 Schema 和允许 Schema 均填写 `PUBLIC`，保存连接。
5. 页面应切换到 `h2-local-test`，状态为 `READY`。
6. 输入并校验以下只读 SQL：

```sql
select ORDER_ID, STATUS from PUBLIC.ORDERS order by ORDER_ID
```

7. 点击“执行 SELECT”，结果应返回两行，`STATUS` 分别为 `READY` 和 `PENDING`。

## 禁止事项

- 不得把该 H2 smoke 连接扩展为生产数据库连接。
- 不得在页面、源码、日志或测试数据中写入真实数据库密码、令牌或完整 JDBC URL。
- 不得借本地 H2 验证开放 P1 禁止的 DML 写执行能力。
