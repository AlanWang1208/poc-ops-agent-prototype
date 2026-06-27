package com.company.opsagent.contracts;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.company.opsagent.contracts.agent.AgentTaskResult;
import com.company.opsagent.contracts.agent.AgentToolResult;
import com.company.opsagent.contracts.events.AgentToolCallCompletedPayload;
import com.company.opsagent.contracts.events.AgentToolCallRejectedPayload;
import com.company.opsagent.contracts.events.AgentToolCallRequestedPayload;
import com.company.opsagent.contracts.events.SemanticEvent;
import com.company.opsagent.contracts.events.SemanticEventType;
import com.company.opsagent.contracts.events.WorkflowStartedPayload;
import com.company.opsagent.contracts.sqlworkbench.SqlQueryAction;
import com.company.opsagent.contracts.sqlworkbench.SqlQueryLimits;
import com.company.opsagent.contracts.sqlworkbench.SqlQueryRequest;
import com.company.opsagent.contracts.workflow.OperatorContext;
import com.company.opsagent.contracts.workflow.PolicyDecisionReference;
import com.company.opsagent.contracts.workflow.ReadOnlyCommandEnvelope;
import com.company.opsagent.contracts.workflow.SkillReference;
import com.company.opsagent.contracts.workflow.TraceContext;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.stream.StreamSupport;
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
  void acceptsAgentToolSemanticEventPayloadsAndSchemaTypes() throws Exception {
    OffsetDateTime now = OffsetDateTime.now();
    String workflowId = "11111111-1111-4111-8111-111111111111";
    new SemanticEvent(
        "1.0",
        "22222222-2222-4222-8222-222222222222",
        workflowId,
        2,
        now,
        SemanticEventType.AGENT_TOOL_CALL_REQUESTED,
        new AgentToolCallRequestedPayload(
            SemanticEventType.AGENT_TOOL_CALL_REQUESTED,
            "tool-call-1",
            1,
            "node-health",
            "1.0.0",
            "node-health:1.0.0:input",
            "development",
            "sha256:abc123"));
    new SemanticEvent(
        "1.0",
        "33333333-3333-4333-8333-333333333333",
        workflowId,
        3,
        now,
        SemanticEventType.AGENT_TOOL_CALL_COMPLETED,
        new AgentToolCallCompletedPayload(
            SemanticEventType.AGENT_TOOL_CALL_COMPLETED,
            "tool-call-1",
            1,
            "node-health",
            "1.0.0",
            "SUCCEEDED",
            "node-health:1.0.0:output"));
    new SemanticEvent(
        "1.0",
        "44444444-4444-4444-8444-444444444444",
        workflowId,
        4,
        now,
        SemanticEventType.AGENT_TOOL_CALL_REJECTED,
        new AgentToolCallRejectedPayload(
            SemanticEventType.AGENT_TOOL_CALL_REJECTED,
            "tool-call-2",
            2,
            "restart-node",
            "1.0.0",
            "POLICY_DENIED",
            "operator is not allowed",
            "policy-v1:workflow-1:tool-call-2"));

    JsonNode schema = new ObjectMapper()
        .readTree(Path.of("events/semantic-event-v1.schema.json").toFile());
    List<String> typeEnum = StreamSupport.stream(
            schema.path("properties").path("type").path("enum").spliterator(),
            false)
        .map(JsonNode::asText)
        .toList();
    assertTrue(typeEnum.contains("AGENT_TOOL_CALL_REQUESTED"));
    assertTrue(typeEnum.contains("AGENT_TOOL_CALL_COMPLETED"));
    assertTrue(typeEnum.contains("AGENT_TOOL_CALL_REJECTED"));
  }

  @Test
  void rejectsProductionSqlWorkbenchRequests() {
    assertThrows(IllegalArgumentException.class, () -> new SqlQueryRequest(
        "1.0",
        "as400-production",
        "production",
        "ORDERS",
        SqlQueryAction.RUN_READ_ONLY,
        "select * from orders",
        List.of(),
        new SqlQueryLimits(100, 1_000_000, 30),
        "sql-query-1"));
  }

  @Test
  void rejectsInvalidSqlQueryLimits() {
    assertThrows(IllegalArgumentException.class, () -> new SqlQueryLimits(0, 1_000_000, 30));
  }

  @Test
  void acceptsAgentRuntimeTaskStatuses() {
    // Agent 任务结果状态必须和 JSON Schema、前端 Zod Schema 保持一致。
    for (String status : List.of(
        "SUCCEEDED",
        "FAILED_TERMINAL",
        "REJECTED",
        "AGENT_RUNTIME_DISABLED",
        "AGENT_RUNTIME_NOT_CONFIGURED",
        "AGENT_RUNTIME_FAILED")) {
      new AgentTaskResult(
          "1.0",
          "task-" + status.toLowerCase().replace('_', '-'),
          "workflow-1",
          status,
          "diagnostic completed",
          0,
          OffsetDateTime.now());
    }
  }

  @Test
  void acceptsAgentTaskResultWithStructuredToolResults() throws Exception {
    ObjectMapper mapper = new ObjectMapper();
    JsonNode output = mapper.createObjectNode()
        .put("location", "Shanghai")
        .put("condition", "Sunny")
        .put("temperatureCelsius", 31.2);
    AgentToolResult toolResult = new AgentToolResult(
        "1.0",
        "tool-call-weather-1",
        "task-weather-1",
        "workflow-weather-1",
        "SUCCEEDED",
        "weather-current-read:1.0.0:output",
        output,
        null,
        null,
        OffsetDateTime.now());

    AgentTaskResult result = new AgentTaskResult(
        "1.0",
        "task-weather-1",
        "workflow-weather-1",
        "SUCCEEDED",
        "weather query completed",
        1,
        OffsetDateTime.now(),
        List.of(toolResult));

    assertEquals(1, result.toolResults().size());
    JsonNode schema = mapper.readTree(Path.of("agent/agent-task-result-v1.schema.json").toFile());
    assertTrue(schema.path("properties").has("toolResults"));
    assertTrue(StreamSupport.stream(schema.path("required").spliterator(), false)
        .map(JsonNode::asText)
        .anyMatch("toolResults"::equals));
  }

  @Test
  void rejectsObsoleteAgentTaskResultStatus() {
    // 旧的 FAILED 状态信息量不足，不能继续作为跨模块契约状态传递。
    assertThrows(IllegalArgumentException.class, () -> new AgentTaskResult(
        "1.0",
        "task-1",
        "workflow-1",
        "FAILED",
        "diagnostic failed",
        0,
        OffsetDateTime.now()));
  }

  @Test
  void providesWeatherCurrentSkillPackageForAgentScopeAndRegistry() throws Exception {
    Path skillPackage = Path.of("skills/packages/weather-current");
    Path agentScopeSkill = Path.of("../skills/weather-current/SKILL.md");

    assertTrue(Files.exists(agentScopeSkill));
    assertTrue(Files.exists(skillPackage.resolve("manifest.json")));
    assertTrue(Files.exists(skillPackage.resolve("manifest.signature.json")));
    assertTrue(Files.exists(skillPackage.resolve("input.schema.json")));
    assertTrue(Files.exists(skillPackage.resolve("output.schema.json")));
    assertTrue(Files.exists(skillPackage.resolve("tests/happy-path.json")));
    assertTrue(Files.exists(skillPackage.resolve("tests/invalid-parameters.json")));
    assertTrue(Files.exists(skillPackage.resolve("tests/policy-denied.json")));

    ObjectMapper mapper = new ObjectMapper();
    JsonNode manifest = mapper.readTree(skillPackage.resolve("manifest.json").toFile());
    assertTrue("weather-current-read".equals(manifest.path("skillId").asText()));
    assertTrue("1.0.0".equals(manifest.path("version").asText()));
    assertTrue(manifest.path("readOnly").asBoolean());
    assertTrue("READ_ONLY".equals(manifest.path("riskLevel").asText()));

    JsonNode inputSchema = mapper.readTree(skillPackage.resolve("input.schema.json").toFile());
    assertTrue(inputSchema.path("properties").has("location"));
    assertTrue(StreamSupport.stream(inputSchema.path("required").spliterator(), false)
        .map(JsonNode::asText)
        .anyMatch("location"::equals));

    JsonNode outputSchema = mapper.readTree(skillPackage.resolve("output.schema.json").toFile());
    assertTrue(outputSchema.path("$id").asText().contains("weather-current-read/1.0.0/output.schema.json"));
    assertTrue(outputSchema.path("properties").has("condition"));
    assertTrue(outputSchema.path("properties").has("temperatureCelsius"));
  }
}
