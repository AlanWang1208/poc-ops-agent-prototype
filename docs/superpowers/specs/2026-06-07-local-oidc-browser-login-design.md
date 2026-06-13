# 本地模拟 OIDC 浏览器登录联调设计

- 日期：2026-06-07
- 相关任务：T008、T009、M01、M09、M11
- 目标阶段：P1 只读诊断 MVP
- 状态：待评审

## 1. 背景与目标

当前控制面已经具备以下能力：

- 基于 `issuer-uri` / `jwk-set-uri` 的 OIDC Bearer Token 校验；
- 标准浏览器登录入口 `GET /auth/login`、会话查询 `GET /auth/session` 和退出入口 `GET /auth/logout`；
- 前端开发服务器对 `/auth` 与 `/internal` 的本地代理；
- 基于浏览器会话复用同一套服务端授权与审计链路的实现基础。

当前缺口在于：仓库里的本地模拟 OIDC 仅存在于测试代码中，只覆盖发现文档、JWK 和 Bearer Token 校验，不支持浏览器登录所需的授权码流程。因此，前端仍然依赖手工输入 Bearer Token，无法完成“本地前端 + 本地控制面 + 本地模拟 OIDC”的完整登录联调。

本设计的目标是在不改变生产安全边界的前提下，补齐本地联调专用的模拟 OIDC 浏览器登录能力，并将前端切换到浏览器会话优先模式，完成真实登录路径的本地闭环验证。

## 2. 设计范围

本次设计只覆盖以下范围：

- 本地联调专用模拟 OIDC 提供方；
- 控制面本地 OIDC 登录 profile 与配置；
- 操作台浏览器会话登录与只读诊断调用联调；
- 自动化测试、运行手册与验证路径。

本次设计明确不包含以下内容：

- 真实企业 IdP 接入；
- 任意生产写执行、脚本执行或策略绕过；
- 新的外部部署服务；
- 浏览器端授权决策；
- 多租户、外部客户接入或产品边界扩展。

## 3. 方案比较

### 方案 A：补本地联调专用模拟 OIDC 浏览器登录提供方

在控制面本地 profile 下启动最小 OIDC 授权码流程端点，前端改为使用浏览器会话登录。

优点：

- 覆盖真实浏览器登录与会话链路；
- 与未来真实企业 IdP 联调路径一致；
- 前端可以去掉手工 Token 作为默认路径。

缺点：

- 需要补一组本地联调专用端点与配置；
- 需要额外的集成测试与运行手册。

### 方案 B：前端保留双认证路径

前端同时支持浏览器会话与手工 Bearer Token。

优点：

- 联调期间更易排障；
- 对后端本地 mock 的要求略低。

缺点：

- 会增加前端状态复杂度；
- 容易长期保留临时路径；
- 不利于把默认体验收敛到真实登录链路。

### 方案 C：继续只做 Bearer Token 联调

优点：

- 改动最少；
- 直接复用现有测试能力。

缺点：

- 不能验证浏览器登录；
- 不能验证会话态访问受保护接口；
- 不满足“登录联调”的主目标。

推荐采用方案 A。

## 4. 总体设计

### 4.1 架构边界

新增能力仅用于本地联调 profile。生产默认配置继续保持：

- `auth-mode=dev-hs256` 或未来真实 OIDC 配置；
- `browser-login-enabled=false` 仍为默认值；
- 不向默认运行态暴露本地模拟登录端点。

本地联调模式下，控制面通过显式 profile 启用两类能力：

- 本地模拟 OIDC Provider 端点；
- Spring Security OIDC Client Registration 与浏览器会话登录。

前端仍只通过控制面暴露的 `/auth/**` 与 `/internal/**` 接口工作，不直接调用模拟 OIDC Provider 的内部端点。

### 4.2 本地模拟 OIDC Provider

新增一个仅本地联调启用的最小模拟 Provider，建议放在 `backend/control-plane/bootstrap` 模块内部，并通过专用配置类按 profile 装配。其职责是提供最小必要的 OIDC 授权码流程支撑：

- 发现文档端点；
- JWK 集端点；
- 授权端点 `/authorize`；
- 令牌端点 `/token`。

Provider 行为约束如下：

- 使用本地生成的短期 RSA 密钥签发 `id_token` 与 `access_token`；
- 固定支持一个受控 client registration；
- 仅支持授权码模式；
- 使用固定的本地测试身份与角色集合；
- 默认只提供只读角色，例如 `ops-reader`，必要时可通过显式参数切换到 `ops-admin` 或 `ops-auditor` 场景；
- 不实现用户自注册、动态客户端注册、刷新令牌或生产级账号管理。

为避免安全误解，所有端点都必须通过文档与配置明确标记为“仅本地联调使用”。

### 4.3 控制面本地 OIDC 配置

新增一套本地联调配置文件，例如 `application-local-oidc.yaml`，显式覆盖以下项目：

- `ops-agent.security.auth-mode=oidc`
- `ops-agent.security.browser-login-enabled=true`
- `ops-agent.security.browser-registration-id=ops-agent`
- `ops-agent.security.browser-login-success-uri=/auth/session`
- `ops-agent.security.browser-logout-success-uri={baseUrl}/`
- `ops-agent.security.issuer`
- `ops-agent.security.issuer-uri`
- `ops-agent.security.username-claim=preferred_username`
- `ops-agent.security.role-claim=roles`
- 本地 `spring.security.oauth2.client.provider` 与 `registration` 参数

配置文件必须保持显式与独立，不能污染默认 `application.yaml` 的开发态共享密钥路径。

### 4.4 前端会话优先模型

前端从“手工输入 Bearer Token”切换为“浏览器会话优先”模型：

- 应用启动时调用 `GET /auth/session`；
- 未登录时展示登录引导；
- 点击登录后跳转 `GET /auth/login`；
- 登录完成返回后重新加载并读取 `/auth/session`；
- 已登录时展示当前用户名、角色与退出入口；
- 诊断请求通过 `credentials: include` 访问 `/internal/**`；
- 默认不再要求用户填写 Token。

如需保留排障能力，可以保留一个受控的开发态调试入口，但不能让它成为默认路径，也不能让前端依据展示文本推断授权状态。

### 4.5 诊断请求与权限链路

浏览器登录成功后，前端对只读诊断接口的访问仍复用现有控制面鉴权与审计链路：

1. 浏览器会话中的 OIDC 主体被解析为内部 `OperatorIdentity`；
2. `PolicyEnforcementWebFilter` 继续统一执行认证、授权与审计；
3. 只读诊断事件流继续按强类型语义事件输出；
4. 角色不足时继续返回结构化 `403 POLICY_DENIED`；
5. 未登录或会话失效时继续返回结构化 `401 UNAUTHENTICATED`。

该设计不引入新的授权来源，也不允许前端绕过服务端策略。

## 5. 关键流程

### 5.1 浏览器登录成功路径

1. 前端访问 `/auth/session`，收到未登录响应；
2. 用户点击登录，前端跳转 `/auth/login`；
3. 控制面重定向到本地模拟 OIDC Provider 的授权端点；
4. Provider 直接以本地测试身份完成授权并回调控制面的 `/login/oauth2/code/ops-agent`；
5. 控制面向 Provider 的 `/token` 端点换取令牌并建立浏览器会话；
6. 控制面按既定成功地址跳回 `/auth/session`；
7. 前端重新读取 `/auth/session`，进入已登录态；
8. 前端发起只读诊断请求，控制面完成认证、授权、审计与事件流输出。

### 5.2 角色不足路径

1. 浏览器以 `ops-reader` 身份成功登录；
2. 前端访问需要管理员角色的接口；
3. 控制面完成认证但策略拒绝；
4. 前端收到结构化 `403`，展示明确的权限不足状态。

### 5.3 退出路径

1. 前端点击退出；
2. 浏览器跳转 `/auth/logout`；
3. 控制面走 Spring Security `/logout` 流程；
4. 会话清理后回到配置的退出成功地址；
5. 前端再次读取 `/auth/session`，进入未登录态。

## 6. 组件改动

### 6.1 后端

预计新增或修改以下部分：

- 本地模拟 OIDC Provider 配置与控制器；
- 本地 OIDC profile 配置文件；
- 本地联调专用属性对象或条件装配；
- 浏览器登录相关集成测试；
- 本地联调运行手册。

后端实现原则：

- 本地 mock 能力必须显式启用；
- 默认运行态保持关闭；
- 不引入新的持久化敏感数据；
- 不向审计、策略与事件契约引入破坏性变更。

### 6.2 前端

预计修改以下部分：

- `src/api.ts`：补充 `/auth/session` 读取与基于会话的诊断请求；
- `src/types.ts`：增加浏览器会话响应类型；
- `src/App.tsx`：切换到登录态/未登录态/诊断态界面；
- 必要时补充样式与提示文案；
- 保持 `vite.config.ts` 现有 `/auth` 与 `/internal` 代理策略。

前端实现原则：

- 不在浏览器中做授权决策；
- 不使用 `any`；
- 不从文案推断安全状态；
- 所有登录状态均以 `/auth/session` 响应为准。

## 7. 错误处理

需要覆盖的本地联调错误场景：

- 本地 mock provider 未启动或 profile 未启用；
- OIDC client registration 配置缺失；
- `/auth/session` 返回 `401`；
- 会话建立成功但角色不足；
- Token 端点交换失败；
- 浏览器退出后会话未清理；
- 前端事件流请求遇到 `401` 或 `403`。

错误处理原则：

- 后端继续返回结构化错误；
- 前端对 `401` 与 `403` 做明确区分；
- 不输出模型内部推理过程；
- 日志与审计中继续保持脱敏。

## 8. 测试与验证

必须覆盖以下验证层：

- 后端单元测试：本地 mock provider 的关键参数与令牌签发逻辑；
- 后端集成测试：授权码登录成功、会话读取、退出、角色不足；
- 前端构建验证：`npm run build`；
- 本地人工联调：启动前端与控制面，验证登录、诊断、退出；
- 安全回归：未登录 `401`、角色不足 `403`、只读路径仍无生产写执行。

建议增加至少以下自动化场景：

- `/auth/login` 可重定向到本地 Provider；
- `/auth/session` 在未登录与已登录状态下返回稳定结构；
- 浏览器会话可访问 `/internal/healthz`；
- 浏览器会话访问管理员端点时返回 `403`；
- 退出后再次访问 `/auth/session` 返回未登录。

## 9. 运行与回滚

本地联调运行方式需在 runbook 中明确：

- 启动控制面本地 OIDC profile；
- 启动前端开发服务器；
- 使用浏览器访问操作台；
- 完成登录、诊断与退出验证。

回滚方式保持简单：

- 停用本地 OIDC profile；
- 前端回退到联调前版本；
- 默认配置继续使用非浏览器登录路径。

由于本设计仅增加本地联调能力，不涉及生产部署或生产数据迁移，因此回滚不需要数据库迁移补偿。

## 10. 风险与约束

- 如果本地 mock provider 与 Spring Security OIDC 客户端参数不一致，浏览器登录将失败；
- 如果把本地 mock provider 错误纳入默认 profile，会扩大默认暴露面；
- 如果前端保留过多临时 Token 逻辑，后续真实 IdP 联调会出现双路径偏差；
- 如果本地测试身份默认授予管理员角色，容易掩盖授权拒绝问题。

约束要求：

- 默认测试身份应优先使用只读角色；
- 管理员角色仅用于显式测试场景；
- 本地 mock 端点与配置必须在文档中清楚标识；
- 所有新增文档继续使用中文。

## 11. 验收标准

满足以下条件后，本设计对应的实现才算完成：

- 本地模拟 OIDC 浏览器登录可成功建立控制面会话；
- 前端不再默认要求手工 Bearer Token；
- 登录后可发起只读诊断请求并接收语义事件；
- 未登录请求返回 `401`，角色不足请求返回 `403`；
- 本地联调步骤有中文运行手册；
- 自动化测试覆盖成功、拒绝与退出主路径；
- 默认配置未暴露本地 mock 登录端点；
- 不引入生产写执行或安全基线下降。
