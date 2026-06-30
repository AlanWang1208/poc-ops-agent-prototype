package com.company.opsagent.controlplane.modules.workflow;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertInstanceOf;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.company.opsagent.contracts.agent.AgentToolCall;
import com.company.opsagent.contracts.agent.AgentToolResult;
import com.company.opsagent.contracts.events.AgentToolCallCompletedPayload;
import com.company.opsagent.contracts.events.AgentToolCallRejectedPayload;
import com.company.opsagent.contracts.events.AgentToolCallRequestedPayload;
import com.company.opsagent.contracts.events.SemanticEventType;
import com.company.opsagent.contracts.workflow.PolicyDecisionReference;
import com.company.opsagent.contracts.workflow.SkillReference;
import com.company.opsagent.contracts.workflow.TraceContext;
import com.company.opsagent.contracts.workflow.WorkerExecutionRequest;
import com.company.opsagent.contracts.workflow.WorkerExecutionResult;
import com.company.opsagent.contracts.workflow.WorkerExecutionStatus;
import com.company.opsagent.controlplane.modules.audit.AuditEvent;
import com.company.opsagent.controlplane.modules.audit.InMemoryAuditTrail;
import com.company.opsagent.controlplane.modules.agentruntime.AgentRuntimeRequest;
import com.company.opsagent.controlplane.modules.agentruntime.AgentToolCatalogProvider;
import com.company.opsagent.controlplane.modules.agentruntime.AgentToolDescriptor;
import com.company.opsagent.controlplane.modules.agentruntime.AgentToolExecutor;
import com.company.opsagent.controlplane.modules.identity.OperatorIdentity;
import com.company.opsagent.controlplane.modules.policy.PolicyDecision;
import com.company.opsagent.controlplane.modules.policy.PolicyDecisionService;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.time.Clock;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import reactor.core.publisher.Mono;
import reactor.test.StepVerifier;

/**
 * Workflow-backed Tool Executor 的平台守护测试。
 *
 * <p>这些测试故意从 M05 视角验证授权闭环：AgentRuntime 只能提出 ToolCall，
 * 真正的目录校验、策略决策、参数哈希、Tool Step 事实记录和 Worker 请求都必须由
 * 服务端执行器重新生成，不能信任 ToolCall 中夹带的策略引用或参数摘要。
 */
class WorkflowBackedAgentToolExecutorTest {

  private final Clock clock = Clock.fixed(Instant.parse("2026-06-13T12:00:00Z"), ZoneOffset.UTC);
  private final ObjectMapper objectMapper = new ObjectMapper();

  @Test
  void executesReadOnlyToolThroughServerPolicyToolStepAndWorkerGateway() {
    var store = new InMemoryAgentWorkflowStore();
    var eventStore = new InMemoryReadOnlyWorkflowStoreFixture();
    var auditTrail = new InMemoryAuditTrail();
    var policyService = new RecordingPolicyDecisionService(true);
    var workerGateway = new RecordingWorkerGateway(objectMapper, WorkerExecutionStatus.SUCCEEDED);
    AgentToolExecutor executor = new WorkflowBackedAgentToolExecutor(
        catalogProvider(),
        policyService,
        store,
        eventStore,
        auditTrail,
        workerGateway,
        objectMapper,
        clock);

    StepVerifier.create(seedWorkflow(store)
        .then(executor.execute(
            runtimeRequest(),
            toolCall("node-health", "1.0.0", "sha256:caller-supplied"))))
        .assertNext(result -> {
          assertEquals("SUCCEEDED", result.status());
          assertEquals("node-health:1.0.0:output", result.outputSchemaId());
          assertEquals("UP", result.output().get("status").asText());
          assertNull(result.errorCode());
        })
        .verifyComplete();

    assertEquals("internal.agent.tool.execute", policyService.action);
    assertEquals("node-health:1.0.0", policyService.resource);
    assertEquals(List.of("ROLE_ops-reader"), policyService.identity.roles());
    assertEquals(1, workerGateway.requests.size());
    WorkerExecutionRequest workerRequest = workerGateway.requests.get(0);
    assertEquals("workflow-1", workerRequest.command().workflowId());
    assertEquals("READ_ONLY", workerRequest.command().operationClass());
    assertEquals("node-health", workerRequest.command().skill().skillId());
    assertEquals("ROLE_ops-reader", workerRequest.command().operator().roles().get(0));
    assertEquals("trace-1", workerRequest.command().trace().traceId());
    assertNotEquals("caller-decision", workerRequest.command().policyDecision().decisionId());

    StepVerifier.create(store.findToolStepsAfter("workspace-default", "workflow-1", 0))
        .assertNext(step -> {
          assertEquals("tool-call-1", step.toolCallId());
          assertEquals("node-health", step.skillId());
          assertEquals(StoredWorkflowStatus.SUCCEEDED, step.status());
          assertNotEquals("sha256:caller-supplied", step.parametersHash());
          assertFalse(step.parametersHash().isBlank());
          assertNotEquals("caller-decision", step.policyDecisionId());
          assertNull(step.errorCode());
        })
        .verifyComplete();

    StepVerifier.create(eventStore.loadEventsAfter("workflow-1", 0))
        .assertNext(event -> {
          assertEquals(1, event.sequence());
          UUID.fromString(event.eventId());
          assertEquals(SemanticEventType.AGENT_TOOL_CALL_REQUESTED, event.type());
          var payload = assertInstanceOf(AgentToolCallRequestedPayload.class, event.payload());
          assertEquals("tool-call-1", payload.toolCallId());
          assertEquals(1, payload.stepSequence());
          assertEquals("node-health", payload.skillId());
          assertEquals("1.0.0", payload.skillVersion());
          assertEquals("development", payload.targetEnvironment());
          assertNotEquals("sha256:caller-supplied", payload.parametersHash());
        })
        .assertNext(event -> {
          assertEquals(2, event.sequence());
          UUID.fromString(event.eventId());
          assertEquals(SemanticEventType.AGENT_TOOL_CALL_COMPLETED, event.type());
          var payload = assertInstanceOf(AgentToolCallCompletedPayload.class, event.payload());
          assertEquals("tool-call-1", payload.toolCallId());
          assertEquals("SUCCEEDED", payload.status());
          assertEquals("node-health:1.0.0:output", payload.outputSchemaId());
        })
        .verifyComplete();

    List<AuditEvent> auditEvents = auditTrail.snapshot();
    assertEquals(1, auditEvents.size());
    AuditEvent auditEvent = auditEvents.getFirst();
    assertEquals("request-1", auditEvent.requestId());
    assertEquals("trace-1", auditEvent.traceId());
    assertEquals("operator-1", auditEvent.subject());
    assertEquals("internal.agent.tool.execute", auditEvent.action());
    assertEquals("node-health:1.0.0", auditEvent.resource());
    assertEquals("policy-v1", auditEvent.policyVersion());
    assertEquals("ALLOW", auditEvent.result());
    assertEquals("allowed", auditEvent.reason());
  }

  @Test
  void recordsRejectedToolStepWhenServerPolicyDeniesAndDoesNotCallWorker() {
    var store = new InMemoryAgentWorkflowStore();
    var eventStore = new InMemoryReadOnlyWorkflowStoreFixture();
    var auditTrail = new InMemoryAuditTrail();
    var policyService = new RecordingPolicyDecisionService(false);
    var workerGateway = new RecordingWorkerGateway(objectMapper, WorkerExecutionStatus.SUCCEEDED);
    AgentToolExecutor executor = new WorkflowBackedAgentToolExecutor(
        catalogProvider(),
        policyService,
        store,
        eventStore,
        auditTrail,
        workerGateway,
        objectMapper,
        clock);

    StepVerifier.create(seedWorkflow(store)
        .then(executor.execute(
            runtimeRequest(),
            toolCall("node-health", "1.0.0", "sha256:caller-supplied"))))
        .assertNext(result -> {
          assertEquals("REJECTED", result.status());
          assertEquals("POLICY_DENIED", result.errorCode());
        })
        .verifyComplete();

    assertEquals("internal.agent.tool.execute", policyService.action);
    assertEquals("node-health:1.0.0", policyService.resource);
    assertEquals(0, workerGateway.requests.size());
    StepVerifier.create(store.findToolStepsAfter("workspace-default", "workflow-1", 0))
        .assertNext(step -> {
          assertEquals(StoredWorkflowStatus.FAILED_TERMINAL, step.status());
          assertEquals("POLICY_DENIED", step.errorCode());
          assertNotEquals("sha256:caller-supplied", step.parametersHash());
          assertNotEquals("caller-decision", step.policyDecisionId());
        })
        .verifyComplete();

    StepVerifier.create(eventStore.loadEventsAfter("workflow-1", 0))
        .assertNext(event -> {
          assertEquals(1, event.sequence());
          UUID.fromString(event.eventId());
          assertEquals(SemanticEventType.AGENT_TOOL_CALL_REQUESTED, event.type());
          var payload = assertInstanceOf(AgentToolCallRequestedPayload.class, event.payload());
          assertEquals("tool-call-1", payload.toolCallId());
          assertNotEquals("sha256:caller-supplied", payload.parametersHash());
        })
        .assertNext(event -> {
          assertEquals(2, event.sequence());
          UUID.fromString(event.eventId());
          assertEquals(SemanticEventType.AGENT_TOOL_CALL_REJECTED, event.type());
          var payload = assertInstanceOf(AgentToolCallRejectedPayload.class, event.payload());
          assertEquals("tool-call-1", payload.toolCallId());
          assertEquals("POLICY_DENIED", payload.errorCode());
          assertEquals("missing permission", payload.message());
          assertNotEquals("caller-decision", payload.policyDecisionId());
        })
        .verifyComplete();

    List<AuditEvent> auditEvents = auditTrail.snapshot();
    assertEquals(1, auditEvents.size());
    AuditEvent auditEvent = auditEvents.getFirst();
    assertEquals("request-1", auditEvent.requestId());
    assertEquals("trace-1", auditEvent.traceId());
    assertEquals("operator-1", auditEvent.subject());
    assertEquals("internal.agent.tool.execute", auditEvent.action());
    assertEquals("node-health:1.0.0", auditEvent.resource());
    assertEquals("policy-v1", auditEvent.policyVersion());
    assertEquals("DENY", auditEvent.result());
    assertEquals("missing permission", auditEvent.reason());
  }

  @Test
  void normalizesWorkerNullNodeOutputToEmptyObjectForAgentToolContract() {
    var store = new InMemoryAgentWorkflowStore();
    var eventStore = new InMemoryReadOnlyWorkflowStoreFixture();
    var auditTrail = new InMemoryAuditTrail();
    var policyService = new RecordingPolicyDecisionService(true);
    WorkerGateway workerGateway = request -> Mono.just(new WorkerExecutionResult(
        "1.0",
        request.executionRequestId(),
        request.command().commandId(),
        request.command().workflowId(),
        WorkerExecutionStatus.REJECTED,
        request.command().skill().outputSchemaId(),
        objectMapper.nullNode(),
        "HTTP_SKILL_SOURCE_NOT_CONFIGURED",
        "configured HTTP skill endpoint is not configured",
        request.authorizedAt().plusSeconds(1)));
    AgentToolExecutor executor = new WorkflowBackedAgentToolExecutor(
        catalogProvider(),
        policyService,
        store,
        eventStore,
        auditTrail,
        workerGateway,
        objectMapper,
        clock);

    StepVerifier.create(seedWorkflow(store)
        .then(executor.execute(
            runtimeRequest(),
            toolCall("node-health", "1.0.0", "sha256:caller-supplied"))))
        .assertNext(result -> {
          assertEquals("REJECTED", result.status());
          assertTrue(result.output().isObject());
          assertEquals(0, result.output().size());
          assertEquals("HTTP_SKILL_SOURCE_NOT_CONFIGURED", result.errorCode());
        })
        .verifyComplete();
  }

  private Mono<StoredAgentWorkflow> seedWorkflow(AgentWorkflowStore store) {
    return store.createOrReuse(
        "workflow-1",
        "workspace-default",
        "operator-1",
        "development",
        "idempotency-1",
        OffsetDateTime.now(clock));
  }

  private AgentRuntimeRequest runtimeRequest() {
    return new AgentRuntimeRequest(
        "task-1",
        "workflow-1",
        "workspace-default",
        "operator-1",
        List.of("ROLE_ops-reader"),
        "development",
        "check node health",
        Map.of("nodeId", "node-1"),
        "trace-1",
        "request-1");
  }

  private AgentToolCall toolCall(String skillId, String version, String callerSuppliedParametersHash) {
    return new AgentToolCall(
        "1.0",
        "tool-call-1",
        "task-1",
        "workflow-1",
        1,
        new SkillReference(skillId, version, skillId + ":" + version + ":input", skillId + ":" + version + ":output"),
        "development",
        Map.of("nodeId", "node-1"),
        callerSuppliedParametersHash,
        new PolicyDecisionReference("caller-decision", "caller-policy-v0", "ALLOW"),
        new TraceContext("trace-1", "request-1"),
        OffsetDateTime.now(clock));
  }

  private AgentToolCatalogProvider catalogProvider() {
    return () -> List.of(new AgentToolDescriptor(
        "node-health",
        "1.0.0",
        "只读节点健康检查",
        "node-health:1.0.0:input",
        "node-health:1.0.0:output",
        List.of("nodeId"),
        "READ_ONLY"));
  }

  /**
   * 记录策略服务收到的身份、动作和资源，避免测试只验证返回值而漏掉服务端授权输入。
   */
  private static final class RecordingPolicyDecisionService implements PolicyDecisionService {

    private final boolean allowed;
    private OperatorIdentity identity;
    private String action;
    private String resource;

    private RecordingPolicyDecisionService(boolean allowed) {
      this.allowed = allowed;
    }

    @Override
    public PolicyDecision decide(OperatorIdentity identity, String action, String resource) {
      this.identity = identity;
      this.action = action;
      this.resource = resource;
      return new PolicyDecision(action, resource, "policy-v1", allowed, allowed ? "allowed" : "missing permission");
    }

    @Override
    public String policyVersion() {
      return "policy-v1";
    }
  }

  /**
   * WorkerGateway 测试替身只记录请求并回显关键字段，用来确认控制面提交的是已授权命令信封。
   */
  private static final class RecordingWorkerGateway implements WorkerGateway {

    private final ObjectMapper objectMapper;
    private final WorkerExecutionStatus status;
    private final List<WorkerExecutionRequest> requests = new ArrayList<>();

    private RecordingWorkerGateway(ObjectMapper objectMapper, WorkerExecutionStatus status) {
      this.objectMapper = objectMapper;
      this.status = status;
    }

    @Override
    public Mono<WorkerExecutionResult> execute(WorkerExecutionRequest request) {
      requests.add(request);
      return Mono.just(new WorkerExecutionResult(
          "1.0",
          request.executionRequestId(),
          request.command().commandId(),
          request.command().workflowId(),
          status,
          request.command().skill().outputSchemaId(),
          objectMapper.createObjectNode().put("status", "UP"),
          null,
          null,
          request.authorizedAt().plusSeconds(1)));
    }
  }
}
