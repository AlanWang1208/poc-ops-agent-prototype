package com.company.opsagent.controlplane.modules.agentruntime;

import static org.junit.jupiter.api.Assertions.assertEquals;

import com.company.opsagent.contracts.agent.AgentToolCall;
import com.company.opsagent.contracts.agent.AgentToolResult;
import com.company.opsagent.contracts.workflow.PolicyDecisionReference;
import com.company.opsagent.contracts.workflow.SkillReference;
import com.company.opsagent.contracts.workflow.TraceContext;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

/**
 * 平台守护 Tool Executor 的拒绝边界测试。
 */
class PlatformGuardedAgentToolExecutorTest {

  @Test
  void rejectsToolCallWhenSkillIsNotInPublishedCatalog() {
    AgentToolCatalogProvider catalogProvider = () -> List.of(readOnlyNodeHealthTool());
    AgentToolExecutor executor = new PlatformGuardedAgentToolExecutor(catalogProvider);

    AgentToolResult result = executor.execute(toolCall("restart-node", "1.0.0")).block();

    assertEquals("REJECTED", result.status());
    assertEquals("SKILL_NOT_AVAILABLE", result.errorCode());
  }

  @Test
  void rejectsNonReadOnlySkillInP1() {
    AgentToolCatalogProvider catalogProvider = () -> List.of(new AgentToolDescriptor(
        "restart-node",
        "1.0.0",
        "重启节点",
        "restart-node:1.0.0:input",
        "restart-node:1.0.0:output",
        List.of("nodeId"),
        "LOW"));
    AgentToolExecutor executor = new PlatformGuardedAgentToolExecutor(catalogProvider);

    AgentToolResult result = executor.execute(toolCall("restart-node", "1.0.0")).block();

    assertEquals("REJECTED", result.status());
    assertEquals("ONLY_READ_ONLY_SKILLS_ALLOWED", result.errorCode());
  }

  private AgentToolDescriptor readOnlyNodeHealthTool() {
    return new AgentToolDescriptor(
        "node-health",
        "1.0.0",
        "只读节点健康检查",
        "node-health:1.0.0:input",
        "node-health:1.0.0:output",
        List.of("nodeId"),
        "READ_ONLY");
  }

  private AgentToolCall toolCall(String skillId, String version) {
    return new AgentToolCall(
        "1.0",
        "tool-call-1",
        "task-1",
        "workflow-1",
        1,
        new SkillReference(skillId, version, skillId + ":" + version + ":input", skillId + ":" + version + ":output"),
        "development",
        Map.of("nodeId", "node-1"),
        "sha256:test",
        new PolicyDecisionReference("decision-1", "policy-v1", "ALLOW"),
        new TraceContext("trace-1", "request-1"),
        OffsetDateTime.now());
  }
}
