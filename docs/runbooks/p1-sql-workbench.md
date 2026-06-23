# P1 SQL 工作台运行手册

## 当前能力

- 查询 AS/400 开发和测试连接目录。
- 对单条 `SELECT` 做只读执行前校验。
- 对 `INSERT`、`UPDATE`、`DELETE` 做静态预检，不执行 DML。
- 在控制面与 Worker 两侧独立拒绝非只读 SQL。

## 当前禁止能力

- 生产连接。
- DML、DDL、`CALL`、存储过程、`MERGE` 和多语句脚本执行。
- 浏览器或控制面直接持有 AS/400 凭据。
- 未配置 KeyStore 时回退到明文配置或模拟成功。

## 本地验证

```powershell
backend\mvnw.cmd -f backend\pom.xml -pl contracts,control-plane/modules/sqlworkbench,control-plane/bootstrap,execution-worker -am test

Set-Location frontend\operator-console
npm run build
```

## 真实 AS/400 联调前置条件

1. 为开发或测试环境创建最小权限只读数据库账号。
2. 将凭据写入部署侧 Java KeyStore，不得写入仓库、配置示例或环境变量示例。
3. 管理员启动 Worker 时人工输入 KeyStore 解锁口令。
4. 配置连接标识到 KeyStore 凭据别名和 AS/400 地址的映射。
5. 验证账号无法执行任何写操作，再启用真实查询执行器。

当前代码未启用真实查询执行器。未完成以上步骤时，Worker 会返回稳定失败结果。

## P2 前门禁

- 将人工 KeyStore 解锁替换为无人值守安全解锁。
- 完成结果分页、脱敏、短期留存、过期清理和访问授权。
- 完成查询工作流持久化、取消、超时和恢复演练。
- 完成目标 AS/400 环境上的 Db2 for i 方言与 Explain 验证。
- 按 ADR 0009 完成 SQL 会话与单元契约、DML 影响预览、环境风险策略、受限写 Worker、短事务和安全评审后，才可启用开发环境受控 CRUD。

P1 界面可以展示标准数据库工作台与 AI SQL 助手的目标交互，但所有 DML 执行动作必须只触发预检，不得产生写执行信封。
