package com.company.opsagent.controlplane.modules.agentruntime;

import com.company.opsagent.contracts.agent.AgentToolCall;
import com.company.opsagent.contracts.agent.AgentToolResult;
import com.fasterxml.jackson.databind.node.JsonNodeFactory;
import java.time.OffsetDateTime;
import reactor.core.publisher.Mono;

/**
 * Agent Runtime 模块内的保守 Tool Executor 兜底实现。
 *
 * <p>这个实现不连接 Worker，也不做真实授权。它只保留目录存在性和 P1 只读风险边界，
 * 用于没有装配 M05 workflow-backed executor 的测试或临时运行场景。生产执行链必须由
 * M05 重新执行服务端策略授权、写入 Tool Step，并通过 WorkerGateway 提交已授权命令。
 */
public final class PlatformGuardedAgentToolExecutor implements AgentToolExecutor {

  private final AgentToolCatalogProvider catalogProvider;

  public PlatformGuardedAgentToolExecutor(AgentToolCatalogProvider catalogProvider) {
    this.catalogProvider = catalogProvider;
  }

  @Override
  public Mono<AgentToolResult> execute(AgentRuntimeRequest runtimeRequest, AgentToolCall toolCall) {
    return Mono.just(evaluate(toolCall));
  }

  private AgentToolResult evaluate(AgentToolCall toolCall) {
    AgentToolDescriptor descriptor = catalogProvider.availableTools().stream()
        .filter(tool -> tool.matches(toolCall.skill().skillId(), toolCall.skill().version()))
        .findFirst()
        .orElse(null);
    if (descriptor == null) {
      return rejected(toolCall, toolCall.skill().outputSchemaId(), "SKILL_NOT_AVAILABLE", "skill is not available");
    }
    if (!descriptor.isReadOnly()) {
      return rejected(
          toolCall,
          descriptor.outputSchemaId(),
          "ONLY_READ_ONLY_SKILLS_ALLOWED",
          "only read-only skills are allowed in P1");
    }
    return rejected(
        toolCall,
        descriptor.outputSchemaId(),
        "TOOL_EXECUTION_NOT_CONNECTED",
        "worker execution is not connected yet");
  }

  private AgentToolResult rejected(
      AgentToolCall toolCall,
      String outputSchemaId,
      String errorCode,
      String errorMessage) {
    return new AgentToolResult(
        "1.0",
        toolCall.toolCallId(),
        toolCall.taskId(),
        toolCall.workflowId(),
        "REJECTED",
        outputSchemaId,
        JsonNodeFactory.instance.objectNode(),
        errorCode,
        errorMessage,
        OffsetDateTime.now());
  }
}
