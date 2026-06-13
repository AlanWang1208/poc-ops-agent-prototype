package com.company.opsagent.contracts;

import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.company.opsagent.contracts.agent.AgentTaskRequest;
import com.company.opsagent.contracts.agent.AgentTaskResult;
import com.company.opsagent.contracts.agent.AgentToolCall;
import com.company.opsagent.contracts.agent.AgentToolResult;
import com.company.opsagent.contracts.events.SemanticEvent;
import com.company.opsagent.contracts.events.SemanticEventV2;
import com.company.opsagent.contracts.events.SemanticEventType;
import com.company.opsagent.contracts.events.WorkflowStartedPayload;
import com.company.opsagent.contracts.workflow.OperatorContext;
import com.company.opsagent.contracts.workflow.PolicyDecisionReference;
import com.company.opsagent.contracts.workflow.ReadOnlyCommandEnvelope;
import com.company.opsagent.contracts.workflow.ReadOnlyCommandEnvelopeV2;
import com.company.opsagent.contracts.workflow.SkillReference;
import com.company.opsagent.contracts.workflow.TraceContext;
import com.company.opsagent.contracts.workflow.WorkspaceContext;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

/**
 * 验证跨模块契约在信任边界拒绝写操作和不一致事件。
 */
class ContractsTest {

  @Test
  void rejectsNonReadOnlyCommand() {
    assertThrows(IllegalArgumentException.class, () -> new ReadOnlyCommandEnvelope(
        "1.0",
        "command-1",
        "workflow-1",
        "idempotency-1",
        "WRITE",
        "development",
        new SkillReference("node-health-read", "1.1.0", "input", "output"),
        new ObjectMapper().createObjectNode(),
        new OperatorContext("operator-1", List.of("ROLE_ops-reader")),
        new PolicyDecisionReference("decision-1", "policy-v1", "ALLOW"),
        new TraceContext("trace-1", "request-1"),
        OffsetDateTime.now()));
  }

  @Test
  void rejectsMismatchedSemanticEventPayload() {
    assertThrows(IllegalArgumentException.class, () -> new SemanticEvent(
        "1.0",
        "event-1",
        "workflow-1",
        1,
        OffsetDateTime.now(),
        SemanticEventType.SKILL_ROUTED,
        new WorkflowStartedPayload(SemanticEventType.WORKFLOW_STARTED, "command-1", "operator-1")));
  }

  @Test
  void rejectsNonReadOnlyWorkspaceAwareCommand() {
    assertThrows(IllegalArgumentException.class, () -> new ReadOnlyCommandEnvelopeV2(
        "2.0",
        new WorkspaceContext("workspace-default", "default", "默认工作空间"),
        "command-1",
        "workflow-1",
        "idempotency-1",
        "WRITE",
        "development",
        new SkillReference("node-health-read", "1.1.0", "input", "output"),
        new ObjectMapper().createObjectNode(),
        new OperatorContext("operator-1", List.of("ROLE_ops-reader")),
        new PolicyDecisionReference("decision-1", "policy-v1", "ALLOW"),
        new TraceContext("trace-1", "request-1"),
        OffsetDateTime.now()));
  }

  @Test
  void rejectsWorkspaceAwareSemanticEventWithoutWorkspace() {
    assertThrows(IllegalArgumentException.class, () -> new SemanticEventV2(
        "2.0",
        " ",
        "event-1",
        "workflow-1",
        1,
        OffsetDateTime.now(),
        SemanticEventType.WORKFLOW_STARTED,
        new WorkflowStartedPayload(SemanticEventType.WORKFLOW_STARTED, "command-1", "operator-1")));
  }

  @Test
  void rejectsAgentTaskWithoutWorkspaceContext() {
    assertThrows(NullPointerException.class, () -> new AgentTaskRequest(
        "1.0",
        "task-1",
        "idempotency-1",
        null,
        new OperatorContext("operator-1", List.of("ROLE_ops-reader")),
        "development",
        "查看 node-1 健康状态",
        Map.of("nodeId", "node-1"),
        new PolicyDecisionReference("decision-1", "policy-v1", "ALLOW"),
        new TraceContext("trace-1", "request-1"),
        OffsetDateTime.now()));
  }

  @Test
  void rejectsAgentToolCallWithoutParameterHash() {
    assertThrows(IllegalArgumentException.class, () -> new AgentToolCall(
        "1.0",
        "tool-call-1",
        "task-1",
        "workflow-1",
        1,
        new SkillReference("node-health", "1.0.0", "node-health:1.0.0:input", "node-health:1.0.0:output"),
        "development",
        Map.of("nodeId", "node-1"),
        " ",
        new PolicyDecisionReference("decision-1", "policy-v1", "ALLOW"),
        new TraceContext("trace-1", "request-1"),
        OffsetDateTime.now()));
  }

  @Test
  void rejectsAgentTaskResultWithoutSummary() {
    assertThrows(IllegalArgumentException.class, () -> new AgentTaskResult(
        "1.0",
        "task-1",
        "workflow-1",
        "SUCCEEDED",
        " ",
        1,
        OffsetDateTime.now()));
  }

  @Test
  void rejectsAgentToolResultWithoutStatus() {
    assertThrows(IllegalArgumentException.class, () -> new AgentToolResult(
        "1.0",
        "tool-call-1",
        "task-1",
        "workflow-1",
        " ",
        "node-health:1.0.0:output",
        new ObjectMapper().createObjectNode(),
        null,
        null,
        OffsetDateTime.now()));
  }

  @Test
  void containsAgentRuntimeSchemas() {
    assertTrue(Files.exists(Path.of("agent", "agent-task-request-v1.schema.json")));
    assertTrue(Files.exists(Path.of("agent", "agent-task-result-v1.schema.json")));
    assertTrue(Files.exists(Path.of("agent", "agent-tool-call-v1.schema.json")));
    assertTrue(Files.exists(Path.of("agent", "agent-tool-result-v1.schema.json")));
  }
}
