# ADR 0003：操作台前端工具链

- 状态：Accepted
- 日期：2026-06-06
- 修订日期：2026-06-13
- 负责人：前端负责人
- 相关模块：M09、M11
- 相关任务：P1 只读操作台

## 背景

P1 需要交付消费语义事件和真实控制面接口的只读操作台。操作台需要保持较低的构建与部署复杂度，同时在采用 JavaScript 开发时仍对外部数据边界进行静态检查和运行时校验。

## 决策

操作台采用 React、JavaScript/JSX、JSDoc、TypeScript `checkJs` 和 Vite 8。JavaScript 源码使用 JSDoc 表达数据与组件契约，并通过严格模式 `checkJs` 执行静态检查。

所有外部 API 与 SSE 数据必须通过 Zod 做运行时校验。路由和查询缓存只负责页面导航与服务端状态缓存，不得承载授权决策，也不得作为执行事实源。操作台仅通过控制面 API 和 SSE 读取或提交已定义请求，不直接访问 Worker 或目标系统。

2026-06-13 将 Vite 6 和 `@vitejs/plugin-react` 4 升级为 Vite 8 和 `@vitejs/plugin-react` 6。原因是 Vite 6 依赖的 esbuild 兼容版本受到高危供应链漏洞 `GHSA-gv7w-rqvm-qjhr` 影响，且 Vite 6 范围内没有兼容修复版本。直接覆盖到已修复 esbuild 版本会破坏 Vite 6 的生产转译，因此经明确批准升级主版本，禁止通过忽略审计告警或保留不兼容 override 规避问题。

## 依赖选择

- React：构建单页操作台和组件体系，MIT 许可证。
- Vite 8 与 `@vitejs/plugin-react` 6：开发服务器、React 转换和静态构建，MIT 许可证；要求 Node.js `^20.19.0` 或 `>=22.12.0`。
- TypeScript：仅用于 `checkJs` 静态检查，不要求业务源码使用 TypeScript，Apache-2.0 许可证。
- Zod：校验 API、SSE 和其他外部不可信数据，MIT 许可证。
- React Router：管理页面路由，不承担授权判断，MIT 许可证。
- TanStack Query：管理服务端状态缓存，不作为执行事实源，MIT 许可证。
- Lucide React：提供界面图标，ISC 许可证。
- Monaco Editor React：提供 SQL 编辑器集成，MIT 许可证。
- Vitest、React Testing Library、Mock Service Worker 和 Playwright：提供组件、接口边界和浏览器流程验证，许可证均为宽松开源许可证。

新增依赖不能降低服务端安全基线，也不能在浏览器中引入授权决策或执行事实源。

## 考虑过的备选方案

### React 与 TypeScript 业务源码

可以提供编译期类型约束，但本项目已确认使用 JavaScript 作为前端开发语言。JSDoc、严格 `checkJs` 和 Zod 组合用于保留静态检查与外部边界运行时校验。

### Next.js

当前操作台是公司内部单页应用，不需要服务端渲染或公开内容优化，因此暂不引入额外运行时和部署复杂度。

### 自定义 Webpack

可以满足要求，但需要维护更多构建配置，P1 没有足够收益。

## 影响

- 业务页面和组件使用 `.js`、`.jsx` 与 JSDoc，现有 TypeScript 页面将在后续重写任务中迁移。
- 前端开发、CI 和构建环境必须使用 Vite 8 支持的 Node.js 版本。
- `checkJs`、ESLint、组件测试和生产构建共同组成前端质量门禁。
- 外部数据即使具有 JSDoc 声明，也必须先通过 Zod 校验才能进入页面状态。
- 路由可控制页面可见性，但操作授权、安全状态和执行状态必须以服务端返回为准。
- 查询缓存仅用于改善读取体验，不能替代关系型数据库、持久化工作流或审计事实源。

## 验证方式

- `npm run check` 必须通过，验证 JavaScript/JSDoc 的严格静态检查。
- `npm run lint` 必须通过，验证 JavaScript/JSX 代码规范。
- `npm run test` 必须通过，验证组件和数据边界行为。
- `npm run test:e2e` 用于验证浏览器关键流程。
- `npm run build` 必须通过，并串行执行静态检查、Lint、测试和 Vite 构建。
- `npm audit` 必须报告 `0 vulnerabilities`，不得以未评审例外忽略高危构建依赖。
- API 与 SSE 契约失败必须进入稳定错误状态，不能继续使用未校验数据。
- 操作台不得根据路由、缓存或展示文本推断授权与执行状态。

## 发布与回滚

构建生成静态制品。发布前保留上述验证证据，并确认依赖许可证清单没有引入不兼容条款。回滚通过部署上一已验证 Commit 的静态制品完成。

Vite 8 升级回滚必须整体恢复上一已验证 Commit 的 Vite、React 插件、配置和锁文件，并重新执行依赖审计；不得回滚到仍包含已知高危漏洞的 Vite 6 制品后直接发布。若 JavaScript 工具链迁移需要整体撤销，则恢复上一版本配置、锁文件和对应页面源码，不保留混合工具链。
