# SQL 工作台视觉 QA

- QA 日期：2026-06-14
- 模块：M09 操作台
- 页面：`/sql`
- 视觉事实源：`D:\poc-ops-agent\figma-prototype\ops-agent-aia-prototype.html` 中 `#sql-workbench-screen`
- 用户补充参考图：`C:\Users\Lenovo\AppData\Local\Temp\codex-clipboard-204b77b3-c58f-44ae-a011-554cd9b3df12.png`
- 参考截图：`frontend/operator-console/.artifacts/sql-reference-screen.png`
- React 截图：`frontend/operator-console/.artifacts/sql-react-screen.png`
- 截图尺寸：`1440x1060`

## 结论

final result: passed

React 页面已改为独立渲染原型 screen，不再套用通用 `AppShell`。当前截图与原型在以下关键区域一致：

- 左侧胶囊导航的位置、宽度、导航项数量、active 状态、底部搜索与动作区。
- 顶部 EA 胶囊、品牌锁定区、SQL 当前页胶囊和三节点信号线。
- SQL 连接工具条的坐标、尺寸、连接、环境、事务、展开工作区和连接状态。
- 主工作台大卡片、数据库对象栏、查询编辑区、结果表格和右侧 AI SQL 助手的三列比例。
- 背景降噪覆盖与原型一致：淡网格、无顶部 screen 扫描线、左侧导航轻阴影。

## 安全边界检查

- 页面仍只通过 `src/api/sql-api.js` 调用 `GET /internal/sql-workbench/connections` 与 `POST /internal/sql-workbench/queries/validate`。
- 生产连接不显示、不调用。
- `执行当前语句` 与 `执行脚本` 只映射到服务端 SQL 校验或 DML 预检契约，不提供真实写执行。
- AI 建议按钮和 AI 输入保持禁用，不进入执行链路。
- 未添加 Commit、Rollback、生产写执行或任意脚本执行能力。

## 剩余说明

- 浏览器字体抗锯齿和动画帧可能导致个别像素在不同机器上轻微变化。
- 当前 QA 使用 Playwright 拦截 SQL API 响应获取稳定截图，不依赖运行时 mock 成功数据。
