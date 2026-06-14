# AgentScope Java 主运行时 POC 运行手册

## 当前状态

AgentScope Java 已作为 M04 主运行时接入控制面，但默认关闭。控制面新增受保护入口：

```text
POST /api/v1/agent/diagnostics
```

该入口必须先通过 M01 身份认证、M02 策略授权和审计记录。客户端不得传入授权结论、策略版本或工作流事实源字段。

## 启用条件

在开发或评测环境中配置：

```yaml
ops-agent:
  agent-runtime:
    enabled: true
    provider: agentscope
    model-name: "<openai-compatible-model>"
    base-url: "<openai-compatible-base-url>"
    api-key-env: AGENTSCOPE_API_KEY
```

密钥必须通过运行环境注入，不得写入源码、配置样例、日志或测试数据。

## 回退

将以下配置恢复为默认值并重启控制面：

```yaml
ops-agent:
  agent-runtime:
    enabled: false
```

回退后：

- `/api/v1/agent/diagnostics` 返回 `AGENT_RUNTIME_DISABLED`。
- `/internal/diagnostics/read-only` 单 Skill 只读闭环继续可用。
- 历史 Agent workflow、Tool Step 和审计记录不得删除或篡改。

## 验证命令

从 `backend` 目录运行：

```powershell
.\mvnw.cmd -pl control-plane/modules/agentruntime -am test
.\mvnw.cmd -pl control-plane/modules/workflow -am test
.\mvnw.cmd -pl control-plane/bootstrap -am test
.\mvnw.cmd -pl control-plane/bootstrap -am dependency:tree '-Dincludes=io.modelcontextprotocol.sdk:*'
```

期望：

- 所有测试通过。
- dependency tree 不出现 `io.modelcontextprotocol.sdk` 依赖条目。

## 故障处理

| 现象 | 处理 |
|---|---|
| 返回 `AGENT_RUNTIME_DISABLED` | 检查 `ops-agent.agent-runtime.enabled` 是否为 `true` |
| 返回 `AGENT_RUNTIME_NOT_CONFIGURED` | 检查 `model-name`、`base-url` 和 `api-key-env` 指向的运行环境变量 |
| 返回 `POLICY_DENIED` | 检查调用身份是否具备 `internal.agent.diagnostics.read` 对应角色 |
| Agent 输出为空 | 检查模型供应方响应；平台只返回最终文本摘要，不暴露模型内部推理 |
| 出现非只读工具调用 | 保持 P1 拒绝，不得临时放宽策略；先补安全评审和 ADR |
