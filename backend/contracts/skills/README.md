# Skill 契约

本目录保存 M03 Skill 契约与注册中心的规范文件，当前阶段重点是：

- `skill-manifest.schema.json`：Skill Manifest 主契约
- `skill-publication.schema.json`：Skill 发布签名侧文件契约
- `packages/<skill>/manifest.json` + `packages/<skill>/manifest.signature.json`：Skill 注册中心启动期扫描的最小交付物
- `packages/<skill>/input.schema.json` + `packages/<skill>/output.schema.json`：平台 Tool 输入和输出边界
- `packages/<skill>/tests/*.json`：M11 后续契约测试和评测样例

这些文件由 `backend/skills/<skill>/` 源包生成，开发者不应直接手写生成产物。源包中的 `SKILL.md` 保持 AgentScope Java 文件系统 Skill 入口；`skill.package.yaml`、`schemas/` 和 `examples/` 作为 Ops Agent 私有注册源，由 `tools/skills/skill-package-tool.ps1` 生成本目录下的契约包。

当前设计要求：

1. 每个平台注册 Skill 必须在 `packages/<skill>/` 提供独立 `manifest.json`
2. 每个 Manifest 必须提供配套 `manifest.signature.json`
3. Manifest 必须声明责任人、版本、输入参数和权限要求
4. P1 阶段 `readOnly=true`，且 `riskLevel=READ_ONLY`
5. 控制面注册中心启动时必须通过摘要和签名校验后才允许登记
6. 平台运行时 JSON 由源包工具生成，CI 必须通过 `generate-all --check` 防止源包和生成产物漂移
7. `backend/skills` 中的 `SKILL.md` 不得包含平台私有发布治理字段，平台私有注册字段放在同目录 `skill.package.yaml`

后续路由、执行和审计模块都以这里的契约为准，不允许绕开契约直接挂接匿名能力。
