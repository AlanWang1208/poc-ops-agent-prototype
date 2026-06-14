# 操作台

操作台是 `M09` 的前端交付单元。

## 主要职责

- 展示强类型语义事件流。
- 消费后端提供的浏览器会话状态，而不是在前端做授权决策。
- 触发只读诊断请求，并在事件流中断时尝试恢复。
- 明确呈现登录状态、权限不足和执行失败等服务端结果。

## 禁止事项

- 不在浏览器中自行做授权决策。
- 不直接调用目标系统。
- 不绕过控制面的策略、审计、幂等和恢复语义。
- 不把模型文本或展示文案当作安全状态事实源。

## SQL 工作台

- 只展示控制面返回的 AS/400 开发和测试连接。
- 支持单条 SELECT 校验以及 INSERT、UPDATE、DELETE 静态预检。
- P1 不提供 DML 执行、交互事务、Commit 或 Rollback。
- Copilot 区域当前只表达安全边界，模型能力通过评测门禁前保持禁用。
- 目标交互以主流数据库客户端为基线，包含对象浏览、多 SQL 文件标签、传统编辑器、执行工具栏和完整结果区；AI SQL 助手在右侧提供错误分析和性能优化。
- P2 计划开放开发环境受控 CRUD；生产 SQL 连接在所有阶段均不可见、不可调用。

## 本地开发

```powershell
npm install
npm run dev
```

开发服务器会把 `/auth` 和 `/internal` 请求代理到本机控制面 `http://127.0.0.1:8080`。

## 本地 Mock OIDC 联调

默认联调方式是浏览器会话登录：

1. 启动控制面并启用 `local-oidc` profile。
2. 打开操作台首页。
3. 点击“使用本地 Mock OIDC 登录”。
4. 登录成功后，页面会显示当前主体和角色。
5. 诊断请求默认复用浏览器会话访问 `/internal/**`。

如需排障，页面保留可折叠的 Bearer Token 覆盖入口，但这不是默认链路。

详细步骤见 [docs/runbooks/local-oidc-mock-testing.md](/C:/Users/Lenovo/Documents/ops-agent/docs/runbooks/local-oidc-mock-testing.md)。

## 本地构建

```powershell
npm run build
```
