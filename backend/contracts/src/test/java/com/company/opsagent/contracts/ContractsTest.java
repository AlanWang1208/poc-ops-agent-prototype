package com.company.opsagent.contracts;

import static org.junit.jupiter.api.Assertions.assertThrows;

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
import com.fasterxml.jackson.databind.ObjectMapper;
import java.time.OffsetDateTime;
import java.util.List;
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
}
