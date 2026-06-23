# 本地 Mock OIDC 登录联调手册

## 目的

本手册用于在开发机上联调以下链路：

`浏览器 -> 操作台 -> 控制面 /auth -> 本地 Mock OIDC -> 浏览器会话 -> /internal 只读接口`

该方案仅用于本地开发和回归验证，不用于测试环境或生产环境。

## 适用范围

- 控制面通过 `local-oidc` profile 启用浏览器登录。
- 本地 Mock OIDC Provider 与控制面运行在同一个 Spring Boot 进程内。
- 前端默认使用浏览器会话访问 `/internal/**`。
- 如需排障，前端保留可折叠的 Bearer Token 覆盖入口。

## 安全边界

- `ops-agent.local-oidc-provider.*` 默认关闭，只有显式启用 `local-oidc` profile 时才暴露。
- Mock OIDC 仅提供本地授权码登录闭环，不引入生产绕过路径。
- `/internal/**` 仍然经过服务端身份、策略和审计过滤，不把授权逻辑下放到前端。
- 只读诊断链路如需真正调用 Worker，仍需启动本地 `execution-worker`。

## 前置条件

1. 安装 Java 21。
2. 安装 Node.js 20+ 与 npm。
3. 在 PowerShell 中设置本地 `JAVA_HOME`：

```powershell
$env:JAVA_HOME='C:\Program Files\RedHat\java-21-openjdk-21.0.10.0.7-1'
```

## 启动顺序

以下命令默认从仓库根目录执行。

1. 启动本地 Worker：

```powershell
Set-Location .\backend
.\mvnw.cmd -f .\execution-worker\pom.xml spring-boot:run
```

2. 启动控制面并启用本地 OIDC profile：

```powershell
Set-Location .\backend
.\mvnw.cmd -f .\control-plane\bootstrap\pom.xml spring-boot:run -Dspring-boot.run.profiles=local-oidc
```

3. 启动前端开发服务器：

```powershell
Set-Location .\frontend\operator-console
npm install
npm run dev
```

说明：

- Vite 会把 `/auth` 和 `/internal` 请求代理到 `http://127.0.0.1:8080`。
- 本地 Mock OIDC 发行者地址固定为 `http://127.0.0.1:8080/mock-oidc`。

## 手工联调步骤

1. 打开 `http://127.0.0.1:5173`。
2. 页面首屏应先显示“登录状态”卡片。
3. 点击“使用本地 Mock OIDC 登录”。
4. 浏览器应经由 `/auth/login` 跳转并最终返回操作台。
5. 登录成功后，页面应显示：
   - 用户名 `local.reader`
   - 角色 `ROLE_ops-reader`
   - 认证类型不再是 `anonymous`
6. 在“节点名称”输入框中保持默认值或输入新的节点名。
7. 点击“启动只读诊断”。
8. 页面应按顺序渲染语义事件，并最终进入完成态。

## 期望结果

- `GET /auth/session` 在匿名状态返回 `401`，登录后返回已认证主体。
- 浏览器会话可直接访问 `GET /internal/healthz`。
- 只读诊断请求在未登录时不可用，登录或提供调试 Token 后才可提交。
- 事件流中断时，前端会尝试从持久化事件恢复，而不是重复创建工作流。
- `ROLE_ops-reader` 无法访问需要更高权限的内部端点。

## 自动化验证

后端本地 OIDC 相关回归测试：

```powershell
Set-Location .\backend
.\mvnw.cmd -f .\control-plane\bootstrap\pom.xml -Dtest=LocalOidcProviderControllerTest,LocalOidcBrowserLoginIntegrationTest -Dsurefire.failIfNoSpecifiedTests=false test
```

前端构建验证：

```powershell
Set-Location .\frontend\operator-console
npm run build
```

## 常见问题

### 控制面启动时报 issuer 发现失败

检查是否使用了 `local-oidc` profile，并确认本地 profile 中使用的是显式：

- `ops-agent.security.jwk-set-uri`
- `spring.security.oauth2.client.provider.ops-agent.authorization-uri`
- `spring.security.oauth2.client.provider.ops-agent.token-uri`
- `spring.security.oauth2.client.provider.ops-agent.jwk-set-uri`

本地 Mock OIDC 与控制面同进程运行时，不应依赖启动阶段的 `issuer-uri` 自发现。

### `/internal/diagnostics/read-only/events` 返回 401 或 403

- `401`：通常表示浏览器会话未建立，或调试 Token 无效。
- `403`：通常表示当前角色不满足服务端策略要求。

### 只读诊断长时间没有完成

优先检查本地 `execution-worker` 是否已启动，以及 `node-health-read` 是否仍在允许列表内。

## 回滚

- 停止本地控制面、Worker 和前端开发服务器。
- 不再使用 `local-oidc` profile 启动控制面。
- 如需清理本地工作流状态，可在停进程后删除 `var/workflow/control-plane*` 开发数据库文件。
