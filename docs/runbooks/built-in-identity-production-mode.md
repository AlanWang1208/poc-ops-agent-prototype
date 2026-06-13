# 正式内建身份模式运行手册

## 1. 适用范围

本手册适用于以下场景：

- 生产环境没有企业 SSO 或外部 IdP。
- 控制面需要启用正式内建账号、密码和浏览器会话能力。
- `local-oidc` 仅保留为本地联调能力，不参与生产启用或回退。

本手册不覆盖以下内容：

- 多租户能力；
- 自助找回密码；
- 完整 MFA 落地；
- 内建 OIDC Token 对外发行。

## 2. 启用前提

启用正式内建身份模式前，必须同时满足：

- 已完成数据库备份与回滚演练。
- 首个管理员账号、角色授予和密码凭据已通过受控方式预置到身份表。
- 生产环境未启用 `local-oidc` profile。
- 生产配置中的浏览器 Cookie 已启用 `Secure=true`。
- 审计落盘路径、数据库连接和策略配置已通过预检查。

当前实现的首个管理员账号预置仍采用受控数据库变更方式完成，启用步骤本身不负责自动开户。

## 3. 关键配置

正式内建身份模式至少需要以下配置：

```yaml
ops-agent:
  security:
    auth-mode: built-in
    browser-login-enabled: true
  built-in-identity:
    schema-initializer-enabled: true
    lockout-threshold: 5
    lockout-duration: 15m
    session-idle-timeout: 15m
    session-absolute-timeout: 8h
    session-cookie-name: OPS_AGENT_SESSION
    session-cookie-secure: true
    session-cookie-same-site: Lax
    session-cookie-max-age: 8h
```

生产要求：

- `ops-agent.security.auth-mode` 必须为 `built-in`。
- `ops-agent.security.browser-login-enabled` 必须为 `true`。
- `ops-agent.built-in-identity.session-cookie-secure` 在生产必须为 `true`。
- 不允许同时启用 `local-oidc` profile。

## 4. 数据库对象

启用时会初始化以下正式身份表：

- `identity_account`
- `identity_account_role_grant`
- `identity_password_credential`
- `identity_account_session`
- `identity_password_reset_ticket`

这些表属于 `M01` 的正式事实源。禁止 `bootstrap`、`M02` 或其他模块绕过 `M01` 接口直接读取业务语义。

## 5. 上线步骤

1. 确认数据库连接、备份和回滚窗口。
2. 预置首个管理员账号、`ROLE_ops-admin` 授予记录和密码凭据。
3. 部署包含正式身份迁移脚本与 `M01` 正式模块的控制面版本。
4. 将生产配置切换到 `auth-mode=built-in`，并确认未启用 `local-oidc` profile。
5. 启动控制面，确认身份表初始化成功。
6. 使用管理员账号访问 `/auth/login` 提交用户名与密码。
7. 登录成功后访问 `/auth/session` 与 `/internal/healthz` 做首轮验证。
8. 由管理员执行一次受控密码重置与首次改密演练。
9. 验证 `/auth/logout` 后旧会话已失效。

## 6. 上线后验证

最小验证清单：

- 管理员账号可成功登录。
- 普通读者账号可访问 `/internal/healthz`。
- 连续错误密码会触发锁定。
- 管理员重置密码后，旧会话立即失效。
- 临时密码登录后必须先改密，改密前不能访问 `/internal/**`。
- `/auth/logout` 后旧 Cookie 无法继续访问受保护接口。
- `local-oidc` 相关端点在生产模式下不参与登录闭环。

建议执行的自动化验证命令：

```powershell
backend\mvnw.cmd -f .\backend\pom.xml -pl contracts,control-plane/modules/identity,control-plane/bootstrap -am "-Dtest=ContractsTest,IdentityContractsTest,IdentityClaimsMapperTest,IdentityModuleTest,IdentityPersistenceSchemaTest,IdentityProductionSkeletonTest,R2dbcIdentityRepositoriesIntegrationTest,DefaultIdentityAuthenticationServiceTest,DefaultIdentitySessionQueryServiceTest,IdentityBuiltInLifecycleTest,BrowserAuthenticationControllerTest,BuiltInBrowserAuthenticationIntegrationTest,ControlPlaneApplicationTest,LocalOidcProviderControllerTest,LocalOidcBrowserLoginIntegrationTest,ControlPlaneOidcIntegrationTest" "-Dsurefire.failIfNoSpecifiedTests=false" test
```

## 7. 故障处理

常见排查方向：

- 登录直接返回 `500`：优先检查数据库表结构是否与身份迁移脚本一致。
- 登录总是返回 `401`：检查账号状态、密码凭据版本和角色授予是否已生效。
- 登录后访问 `/internal/**` 仍为 `401`：检查会话表是否成功写入，Cookie 名称是否与配置一致。
- 管理员重置密码无效：检查 `internal.identity.password-reset` 是否仍映射到 `ROLE_ops-admin`。
- 生产仍落到 `local-oidc`：检查是否误带 `local-oidc` profile 或本地联调配置。

## 8. 回滚方案

回滚原则：

- 如正式登录路径异常，优先关闭正式内建身份入口。
- 禁止把 `local-oidc` 当作生产回退方案。
- 回退后仍应保留现有只读诊断能力。

回滚步骤：

1. 将生产配置从 `auth-mode=built-in` 切回既有安全模式，例如 `dev-hs256` 仅限隔离环境，或未来外部 IdP 模式。
2. 关闭 `browser-login-enabled`，避免浏览器继续走正式内建入口。
3. 重启控制面并验证 `/internal/**` 的既有认证链路恢复。
4. 根据变更窗口决定是否保留身份表数据，禁止在未完成备份前删除身份数据。
5. 记录故障时间、影响范围、错误码、会话撤销状态和回滚证据。

## 9. 安全提醒

- 不得在仓库、日志、示例配置或工单正文中存放真实密码或密钥。
- 不得在生产启用 `session-cookie-secure=false`。
- 不得把 `local-oidc` profile、Mock 用户或测试密钥带入生产。
- 不得让前端自行推断授权结果，所有授权仍以服务端 `M02` 决策为准。
