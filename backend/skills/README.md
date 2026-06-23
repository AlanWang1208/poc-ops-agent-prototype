# AgentScope Skill

本目录只保存 AgentScope 可发现和加载的文件系统 Skill。每个子目录必须遵循 AgentScope Java 的文件系统 Skill 结构：

```text
backend/skills/<skill-name>/
|-- SKILL.md
|-- references/   # 可选
|-- examples/     # 可选
`-- scripts/      # 可选，P1 不使用
```

`SKILL.md` 是唯一必需入口文件，必须包含 YAML frontmatter，至少提供：

```yaml
---
name: node-health-read
description: Diagnose a single node through the platform read-only tool.
---
```

AgentScope Java 的文件系统仓库会扫描每个子目录的 `SKILL.md`，读取 `name` 和 `description`，并把正文作为 Agent 可加载的技能说明。Agent 使用这些说明来理解什么时候调用哪个平台 Tool、需要哪些输入、如何解释输出，以及必须遵守哪些只读安全边界。

## 当前内置 Skill

| 目录 | AgentScope Skill 名称 | 平台 Tool |
|---|---|---|
| `node-health` | `node-health-read` | `node-health-read` |
| `application-log-summary` | `application-log-summary-read` | `application-log-summary-read` |
| `certificate-expiry` | `certificate-expiry-read` | `certificate-expiry-read` |
| `platform-alert-summary` | `platform-alert-summary-read` | `platform-alert-summary-read` |
| `service-dependency-health` | `service-dependency-health-read` | `service-dependency-health-read` |

## 与平台契约的关系

平台治理用 JSON 不放在本目录。M03 注册中心、发布签名、输入输出 Schema 和 M11 测试样例位于：

```text
backend/contracts/skills/packages/<skill-name>/
|-- manifest.json
|-- manifest.signature.json
|-- input.schema.json
|-- output.schema.json
`-- tests/
    |-- happy-path.json
    |-- invalid-parameters.json
    `-- policy-denied.json
```

`backend/skills` 面向 AgentScope；`backend/contracts/skills/packages` 面向平台注册、治理、契约和测试。两者通过相同的 Skill / Tool 名称关联。

## P1 阶段约束

- Skill 正文只能描述只读诊断能力。
- Skill 不得指示 Agent 直接访问目标系统、执行本地命令、运行脚本或绕过平台 Tool。
- `scripts/` 在 P1 不使用；如后续需要，必须先经过 ADR、安全评审和 Worker 隔离设计。
- Skill 不得包含密钥、生产数据、模型内部推理过程或未脱敏日志。
- AgentScope 只能调用平台暴露的已授权 Tool；权限、审计、工作流事实源和 Worker 隔离仍由平台执行。
