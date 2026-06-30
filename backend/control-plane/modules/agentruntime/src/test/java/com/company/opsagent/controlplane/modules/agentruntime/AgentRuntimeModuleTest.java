package com.company.opsagent.controlplane.modules.agentruntime;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

/**
 * Agent 主运行时模块元信息与显式禁用服务行为测试。
 */
class AgentRuntimeModuleTest {

  @Test
  void exposesModuleId() {
    assertEquals("M04", AgentRuntimeModule.moduleId());
  }

  @Test
  void disabledRuntimeReturnsControlledUnavailableResult() {
    AgentRuntimeService service = new DisabledAgentRuntimeService();
    AgentRuntimeRequest request = new AgentRuntimeRequest(
        "task-1",
        "workflow-1",
        "default",
        "operator-1",
        List.of("ROLE_ops-reader"),
        "development",
        "查看 node-1 健康状态",
        Map.of("nodeId", "node-1"),
        "trace-1",
        "request-1");

    AgentRuntimeResult result = service.run(request).block();

    assertTrue(result != null);
    assertEquals("AGENT_RUNTIME_DISABLED", result.status());
    assertEquals("Agent Runtime is disabled by configuration.", result.summary());
  }
}
