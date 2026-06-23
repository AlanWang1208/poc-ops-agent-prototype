# Agent Tool 执行器平台守护实施计划

> 执行约束：该计划按任务逐步实施，并在每个任务完成后更新复选框状态。

## 目标

补齐 Agent Tool 调用的服务端二次授权、M05 Tool Step 持久化和 M07 Worker 调用切片。

## 架构原则

M04 继续定义 `AgentToolExecutor` 端口和 Agent Runtime 脱敏上下文；真实平台守护执行器落在 M05 `workflow` 模块，避免 M04 反向依赖 M05/M07。执行器忽略模型侧策略字段，使用 `AgentRuntimeRequest` 中的服务端主体、角色和 trace 重新授权，再构造 Worker 执行信封。

## 技术栈

Java 21、Spring WebFlux/Reactor、Maven 多模块、现有 `AgentWorkflowStore`、`PolicyDecisionService`、`WorkerGateway`、Agent/Workflow 契约。

## Task 1：Runtime 上下文契约

相关文件：

- `backend/control-plane/modules/agentruntime/src/main/java/com/company/opsagent/controlplane/modules/agentruntime/AgentRuntimeRequest.java`
- `backend/control-plane/modules/workflow/src/main/java/com/company/opsagent/controlplane/modules/workflow/AgentDiagnosticWorkflowService.java`
- 构造 `AgentRuntimeRequest` 的测试

- [x] Step 1：补充失败编译或失败测试预期，要求 `AgentRuntimeRequest` 构造时携带操作人角色、trace id 和 request id。
- [x] Step 2：为 `AgentRuntimeRequest` 新增 `operatorRoles`、`traceId` 和 `requestId` 字段，并防御性复制角色列表。
- [x] Step 3：从 `AgentTaskRequest` 传递 `operator.roles()`、`trace.traceId()` 和 `trace.requestId()`。

## Task 2：Workflow-backed Agent Tool Executor

相关文件：

- `backend/control-plane/modules/workflow/pom.xml`
- `backend/control-plane/modules/workflow/src/main/java/com/company/opsagent/controlplane/modules/workflow/WorkflowBackedAgentToolExecutor.java`
- `backend/control-plane/modules/workflow/src/test/java/com/company/opsagent/controlplane/modules/workflow/WorkflowBackedAgentToolExecutorTest.java`

- [x] Step 1：编写成功路径测试，覆盖服务端策略重算、运行中 Tool Step 写入、WorkerGateway 调用、`SUCCEEDED` 完成状态和 Worker 输出映射。
- [x] Step 2：编写策略拒绝测试，覆盖拒绝时不调用 Worker、写入失败 Tool Step，并返回 `REJECTED` 与 `POLICY_DENIED`。
- [x] Step 3：实现执行器，改造 `AgentToolExecutor.execute(AgentRuntimeRequest, AgentToolCall)`，忽略 ToolCall 夹带的 `policyDecision()`，仅在服务端 `PolicyDecision.allowed()` 为 true 时生成新的 `PolicyDecisionReference`。

## Task 3：Bootstrap 装配

相关文件：

- `backend/control-plane/bootstrap/src/main/java/com/company/opsagent/controlplane/bootstrap/config/WorkflowConfiguration.java`

- [x] Step 1：将 `WorkflowBackedAgentToolExecutor` 暴露为 `AgentToolExecutor` Bean，依赖 `AgentToolCatalogProvider`、`PolicyDecisionService`、`AgentWorkflowStore`、`WorkerGateway`、`ObjectMapper` 和 `Clock.systemUTC()`。
- [x] Step 2：保持 M04 runtime 独立，不让 `control-plane-agentruntime` 依赖 `control-plane-workflow`；依赖方向仍为 M05 -> M04。

## Task 4：验证和文档

相关文件：

- `docs/planning/project-plan.md`
- `docs/runbooks/agentscope-java-primary-runtime-poc.md`
- `docs/architecture/module-map.md`

- [x] Step 1：更新状态，记录平台守护 Tool Executor 已能持久化 M05 step 并调用 Worker；AgentScope ReAct 回调接线已在 Task 5 补齐最小闭环。
- [x] Step 2：运行验证命令。

## Task 5：AgentScope ReAct 工具回调接线

相关文件：

- `backend/control-plane/modules/agentruntime/src/main/java/com/company/opsagent/controlplane/modules/agentruntime/AgentscopeAgentInvocation.java`
- `backend/control-plane/modules/agentruntime/src/main/java/com/company/opsagent/controlplane/modules/agentruntime/AgentscopePlatformAgentTool.java`
- `backend/control-plane/modules/agentruntime/src/main/java/com/company/opsagent/controlplane/modules/agentruntime/AgentscopeReActAgentClient.java`
- `backend/control-plane/modules/agentruntime/src/test/java/com/company/opsagent/controlplane/modules/agentruntime/AgentscopeReActAgentClientTest.java`

- [x] Step 1：让 `AgentscopeAgentInvocation` 携带 `AgentToolExecutor`，避免 ReAct 客户端自行触达 Worker 或策略实现。
- [x] Step 2：实现 AgentScope `AgentTool` 适配器，把模型 ToolUse 转成强类型 `AgentToolCall`，并将平台 `AgentToolResult` 编码为结构化 ToolResult 文本。
- [x] Step 3：将 `AgentscopeReActAgentClient` 从 `registerSchemas` 改为注册真实 `AgentTool`，确保工具调用在 ReAct 循环内回调平台执行器。
- [x] Step 4：补充测试，覆盖 ReAct ToolUse 经平台执行器执行，并把结果回送给下一轮模型。

已验证：

```powershell
.\backend\mvnw.cmd -f .\backend\pom.xml -B -ntp -pl control-plane/modules/agentruntime,control-plane/modules/workflow,control-plane/bootstrap -am test
.\tools\ci\check-contracts.ps1
```

## 自检

- 规格覆盖：覆盖已确认的窄切片；AgentScope 回调接线已完成最小闭环，Agent Tool 语义事件、执行器级审计契约和终态幂等恢复演练已补齐。
- 占位扫描：无未解释的实现占位。
- 类型一致性：`AgentRuntimeRequest`、`AgentToolExecutor`、`WorkflowBackedAgentToolExecutor`、`AgentWorkflowStore`、`WorkerGateway` 与现有代码命名一致。
