# AgentScope Java 主链路 POC 运行手册

## 当前状态

AgentScope Java 是 P1 只读诊断目标主链路中的 M04 主 Agent Runtime。当前代码已完成运行时边界、受保护入口、禁用/未配置失败关闭、最终摘要 POC、workflow-backed Agent Tool 执行器、AgentScope ReAct 真实工具回调接线、路由解释 API，以及单工具、多工具、注入拒绝和模型超时评测切片；该执行器已经能在服务端重做目录校验、M02 策略决策、执行器级授权审计、参数哈希、M05 Tool Step 持久化、Agent Tool 语义事件发布、M07 WorkerGateway 调用和结果映射。

控制面受保护入口：

```text
POST /api/v1/agent/diagnostics
```

该入口必须先通过 M01 身份认证、M02 策略授权和审计记录。客户端不得传入授权结论、策略版本或工作流事实源字段。

内部路由解释入口：

```text
POST /internal/routing/skills/explain
```

该入口只用于评测、排障和运维解释候选 Skill、筛选条件、命中规则和无候选说明。它必须经过内部认证、授权和审计过滤器；返回内容不得被客户端当作授权结论，也不得降低 M02 服务端策略基线。

确定性单 Skill 只读入口作为联调、兼容和紧急回退路径保留。AgentScope 主链路当前已补齐 Agent Tool 请求、完成和拒绝三类语义事件契约骨架、M05 发布接线、执行器级授权审计、多 Tool 幂等恢复演练、路由解释 API，以及 ReAct 单工具、多工具、Prompt 注入拒绝、Tool 输出注入拒绝和模型超时评测；终态 Agent workflow 会复用持久化的 `AgentTaskResult` 状态、摘要和 toolCallCount。后续剩余工作集中在真实模型供应方联调、远程 CI 门禁固化、集中审计存储和生产级 Worker 隔离演练。

## 主链路运行条件

控制面默认关闭 Agent Runtime。需要真正走模型和 Skill Tool Call 时，优先启用已提交的 `agent-runtime` Spring profile。该 profile 文件位于 `backend/control-plane/bootstrap/src/main/resources/application-agent-runtime.yaml`，只保存非敏感配置：

```yaml
ops-agent:
  agent-runtime:
    enabled: true
    provider: agentscope
    model-name: ${OPS_AGENT_AGENT_RUNTIME_MODEL_NAME:gpt-4.1-mini}
    base-url: ${OPS_AGENT_AGENT_RUNTIME_BASE_URL:https://api.openai.com/v1}
    api-key-env: OPENAI_API_KEY
```

真实 API Key 必须通过运行环境、部署密钥系统或受保护的外部 Spring 配置源注入，不得写入源码、配置样例、日志、Prompt、制品或测试数据。使用 OpenAI 时，运行环境中提供名为 `OPENAI_API_KEY` 的密钥；使用百炼千问时，在目标环境专用配置中覆盖 `model-name`、`base-url` 和 `api-key-env`，仍不得提交真实密钥。

真实 Tool Call 还需要 M02 策略动作 `internal.agent.tool.execute`。基础 `application.yaml` 已为 `ROLE_ops-reader` 和 `ROLE_ops-admin` 配置该动作，避免模型发起工具调用后被平台策略默认拒绝。

不依赖 PowerShell 的启用方式：

```bash
export SPRING_PROFILES_ACTIVE=agent-runtime
export OPENAI_API_KEY="<由密钥系统注入的真实值>"
./mvnw -pl control-plane/bootstrap spring-boot:run
```

也可以在 systemd、Docker、Kubernetes Secret、CI/CD 变量或外部 Spring 配置文件中设置同等配置；原则是 profile 和非敏感模型参数可以进配置文件，真实 Key 只进密钥通道。

未配置模型供应方、API Key 或启用开关时，主入口必须失败关闭，返回明确错误，不得静默改走未审计路径。

## 回退

将以下配置恢复为默认值并重启控制面：

```yaml
ops-agent:
  agent-runtime:
    enabled: false
```

回退后：

- `/api/v1/agent/diagnostics` 返回 `AGENT_RUNTIME_DISABLED`。
- `/internal/diagnostics/read-only` 单 Skill 只读闭环作为兼容和紧急回退路径继续可用。
- 历史 Agent workflow、Tool Step 和审计记录不得删除或篡改。

## 验证命令

从 `backend` 目录运行。Windows 环境：

```powershell
.\mvnw.cmd -pl control-plane/modules/agentruntime -am test
.\mvnw.cmd -pl control-plane/modules/agentrouting -am test
.\mvnw.cmd -pl control-plane/modules/workflow -am test
.\mvnw.cmd -pl control-plane/bootstrap -am test
.\mvnw.cmd -pl control-plane/modules/agentruntime,control-plane/modules/agentrouting,control-plane/modules/workflow,control-plane/bootstrap -am test
.\mvnw.cmd -pl control-plane/modules/agentruntime -am '-Dtest=AgentscopeReActAgentClientTest' '-Dsurefire.failIfNoSpecifiedTests=false' test
.\mvnw.cmd -pl control-plane/bootstrap -am dependency:tree '-Dincludes=io.modelcontextprotocol.sdk:*'
```

Linux、macOS 或容器环境：

```bash
./mvnw -pl control-plane/modules/agentruntime -am test
./mvnw -pl control-plane/modules/workflow -am test
./mvnw -pl control-plane/bootstrap -am test
./mvnw -pl control-plane/modules/agentruntime,control-plane/modules/workflow,control-plane/bootstrap -am test
./mvnw -pl control-plane/modules/agentruntime -am -Dtest=AgentscopeReActAgentClientTest -Dsurefire.failIfNoSpecifiedTests=false test
./mvnw -pl control-plane/bootstrap -am dependency:tree -Dincludes=io.modelcontextprotocol.sdk:*
```

期望：

- 所有测试通过。
- AgentScope 单工具、多工具、注入拒绝和模型超时评测通过。
- `POST /internal/routing/skills/explain` 仅返回路由解释，不返回授权结论。
- dependency tree 不出现 `io.modelcontextprotocol.sdk` 依赖条目。

## 故障处理

| 现象 | 处理 |
|---|---|
| 返回 `AGENT_RUNTIME_DISABLED` | 检查 `ops-agent.agent-runtime.enabled` 是否为 `true` |
| 返回 `AGENT_RUNTIME_NOT_CONFIGURED` | 检查 `agent-runtime` profile、`model-name`、`base-url` 和 `api-key-env` 指向的运行环境变量 |
| 返回 `POLICY_DENIED` | 检查调用身份是否具备 `internal.agent.diagnostics.read` 和 `internal.agent.tool.execute` 对应角色 |
| Agent 输出为空 | 检查模型供应方响应；平台只返回最终文本摘要，不暴露模型内部推理 |
| 出现非只读工具调用 | 保持 P1 拒绝，不得临时放宽策略；先补安全评审和 ADR |
