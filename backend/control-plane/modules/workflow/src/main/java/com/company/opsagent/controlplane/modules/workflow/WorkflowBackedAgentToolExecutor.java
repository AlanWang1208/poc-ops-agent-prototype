package com.company.opsagent.controlplane.modules.workflow;

import com.company.opsagent.contracts.agent.AgentToolCall;
import com.company.opsagent.contracts.agent.AgentToolResult;
import com.company.opsagent.contracts.events.AgentToolCallCompletedPayload;
import com.company.opsagent.contracts.events.AgentToolCallRejectedPayload;
import com.company.opsagent.contracts.events.AgentToolCallRequestedPayload;
import com.company.opsagent.contracts.events.SemanticEvent;
import com.company.opsagent.contracts.events.SemanticEventPayload;
import com.company.opsagent.contracts.events.SemanticEventType;
import com.company.opsagent.contracts.workflow.OperatorContext;
import com.company.opsagent.contracts.workflow.PolicyDecisionReference;
import com.company.opsagent.contracts.workflow.ReadOnlyCommandEnvelope;
import com.company.opsagent.contracts.workflow.SkillReference;
import com.company.opsagent.contracts.workflow.TraceContext;
import com.company.opsagent.contracts.workflow.WorkerExecutionRequest;
import com.company.opsagent.contracts.workflow.WorkerExecutionResult;
import com.company.opsagent.contracts.workflow.WorkerExecutionStatus;
import com.company.opsagent.controlplane.modules.audit.AuditEvent;
import com.company.opsagent.controlplane.modules.audit.AuditTrail;
import com.company.opsagent.controlplane.modules.agentruntime.AgentRuntimeRequest;
import com.company.opsagent.controlplane.modules.agentruntime.AgentToolCatalogProvider;
import com.company.opsagent.controlplane.modules.agentruntime.AgentToolDescriptor;
import com.company.opsagent.controlplane.modules.agentruntime.AgentToolExecutor;
import com.company.opsagent.controlplane.modules.identity.OperatorIdentity;
import com.company.opsagent.controlplane.modules.policy.PolicyDecision;
import com.company.opsagent.controlplane.modules.policy.PolicyDecisionService;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Clock;
import java.time.OffsetDateTime;
import java.util.HexFormat;
import java.util.Map;
import java.util.TreeMap;
import java.util.UUID;
import reactor.core.publisher.Mono;
import reactor.core.scheduler.Schedulers;

/**
 * 由 M05 workflow 承载的 Agent Tool 执行器。
 *
 * <p>这是 AgentScope ToolCall 进入平台执行面的第一个服务端安全边界。它不会信任模型、
 * 前端或 AgentRuntime 传入的授权引用，而是在控制面内重新完成目录校验、策略决策、
 * 参数摘要生成、Tool Step 事实记录和 Worker 命令信封构造。这样可以保证“服务端策略
 * 是唯一授权决策点”，同时让 Worker 只接收已经授权、带版本、可审计的只读命令。
 */
public final class WorkflowBackedAgentToolExecutor implements AgentToolExecutor {

  private static final String ACTION_EXECUTE_AGENT_TOOL = "internal.agent.tool.execute";
  private static final long WORKER_REQUEST_TTL_SECONDS = 30;

  private final AgentToolCatalogProvider catalogProvider;
  private final PolicyDecisionService policyDecisionService;
  private final AgentWorkflowStore agentWorkflowStore;
  private final ReadOnlyWorkflowStore eventStore;
  private final AuditTrail auditTrail;
  private final WorkerGateway workerGateway;
  private final ObjectMapper objectMapper;
  private final Clock clock;

  public WorkflowBackedAgentToolExecutor(
      AgentToolCatalogProvider catalogProvider,
      PolicyDecisionService policyDecisionService,
      AgentWorkflowStore agentWorkflowStore,
      ReadOnlyWorkflowStore eventStore,
      AuditTrail auditTrail,
      WorkerGateway workerGateway,
      ObjectMapper objectMapper,
      Clock clock) {
    this.catalogProvider = catalogProvider;
    this.policyDecisionService = policyDecisionService;
    this.agentWorkflowStore = agentWorkflowStore;
    this.eventStore = eventStore;
    this.auditTrail = auditTrail;
    this.workerGateway = workerGateway;
    this.objectMapper = objectMapper;
    this.clock = clock;
  }

  @Override
  public Mono<AgentToolResult> execute(AgentRuntimeRequest runtimeRequest, AgentToolCall toolCall) {
    return Mono.defer(() -> evaluate(runtimeRequest, toolCall));
  }

  private Mono<AgentToolResult> evaluate(AgentRuntimeRequest runtimeRequest, AgentToolCall toolCall) {
    String parametersHash = serverParametersHash(toolCall.parameters());
    String contextMismatch = contextMismatch(runtimeRequest, toolCall);
    if (contextMismatch != null) {
      return rejectWithRecordedStep(
          runtimeRequest,
          toolCall,
          toolCall.skill().outputSchemaId(),
          parametersHash,
          platformDecisionId(runtimeRequest, toolCall, "CONTEXT_MISMATCH"),
          "TOOL_CONTEXT_MISMATCH",
          contextMismatch);
    }

    AgentToolDescriptor descriptor = catalogProvider.availableTools().stream()
        .filter(tool -> tool.skillId().equals(toolCall.skill().skillId()))
        .filter(tool -> tool.version().equals(toolCall.skill().version()))
        .findFirst()
        .orElse(null);
    if (descriptor == null) {
      return rejectWithRecordedStep(
          runtimeRequest,
          toolCall,
          toolCall.skill().outputSchemaId(),
          parametersHash,
          platformDecisionId(runtimeRequest, toolCall, "SKILL_NOT_AVAILABLE"),
          "SKILL_NOT_AVAILABLE",
          "skill is not available");
    }
    if (!"READ_ONLY".equals(descriptor.riskLevel())) {
      return rejectWithRecordedStep(
          runtimeRequest,
          toolCall,
          descriptor.outputSchemaId(),
          parametersHash,
          platformDecisionId(runtimeRequest, toolCall, "ONLY_READ_ONLY_SKILLS_ALLOWED"),
          "ONLY_READ_ONLY_SKILLS_ALLOWED",
          "only read-only skills are allowed in P1");
    }

    PolicyDecision decision = policyDecisionService.decide(
        new OperatorIdentity(runtimeRequest.operatorId(), runtimeRequest.operatorId(), runtimeRequest.operatorRoles()),
        ACTION_EXECUTE_AGENT_TOOL,
        descriptor.skillId() + ":" + descriptor.version());
    String policyDecisionId = policyDecisionId(decision, runtimeRequest, toolCall);
    if (!decision.allowed()) {
      return rejectWithRecordedStep(
          runtimeRequest,
          toolCall,
          descriptor.outputSchemaId(),
          parametersHash,
          policyDecisionId,
          "POLICY_DENIED",
          decision.reason());
    }

    return recordToolAudit(
            runtimeRequest,
            toolCall,
            decision.policyVersion(),
            "ALLOW",
            decision.reason(),
            OffsetDateTime.now(clock))
        .then(submitAuthorizedReadOnlyCommand(
            runtimeRequest,
            toolCall,
            descriptor,
            parametersHash,
            new PolicyDecisionReference(policyDecisionId, decision.policyVersion(), "ALLOW")));
  }

  private Mono<AgentToolResult> submitAuthorizedReadOnlyCommand(
      AgentRuntimeRequest runtimeRequest,
      AgentToolCall toolCall,
      AgentToolDescriptor descriptor,
      String parametersHash,
      PolicyDecisionReference policyDecision) {
    OffsetDateTime authorizedAt = OffsetDateTime.now(clock);
    StoredAgentToolStep step = runningStep(runtimeRequest, toolCall, descriptor, parametersHash, policyDecision.decisionId(), authorizedAt);
    WorkerExecutionRequest request = new WorkerExecutionRequest(
        "1.0",
        executionRequestId(runtimeRequest, toolCall),
        authorizedAt,
        authorizedAt.plusSeconds(WORKER_REQUEST_TTL_SECONDS),
        new ReadOnlyCommandEnvelope(
            "1.0",
            toolCall.toolCallId(),
            runtimeRequest.workflowId(),
            runtimeRequest.workflowId() + ":" + toolCall.stepSequence() + ":" + parametersHash,
            "READ_ONLY",
            runtimeRequest.targetEnvironment(),
            new SkillReference(
                descriptor.skillId(),
                descriptor.version(),
                descriptor.parameterSchemaId(),
                descriptor.outputSchemaId()),
            objectMapper.valueToTree(new TreeMap<>(toolCall.parameters())),
            new OperatorContext(runtimeRequest.operatorId(), runtimeRequest.operatorRoles()),
            policyDecision,
            new TraceContext(runtimeRequest.traceId(), runtimeRequest.requestId()),
            authorizedAt));

    return agentWorkflowStore.appendToolStep(step)
        .then(appendToolRequestedEvent(
            runtimeRequest,
            toolCall,
            descriptor.skillId(),
            descriptor.version(),
            descriptor.parameterSchemaId(),
            parametersHash,
            authorizedAt))
        .then(workerGateway.execute(request).materialize())
        .flatMap(workerSignal -> {
          if (workerSignal.hasValue()) {
            return completeFromWorkerResult(runtimeRequest, toolCall, descriptor, workerSignal.get());
          }
          if (workerSignal.isOnError()) {
            return completeAfterWorkerFailure(
                runtimeRequest,
                toolCall,
                descriptor,
                "WORKER_GATEWAY_FAILED",
                "worker execution failed");
          }
          return completeAfterWorkerFailure(
              runtimeRequest,
              toolCall,
              descriptor,
              "WORKER_GATEWAY_EMPTY_RESULT",
              "worker execution completed without a result");
        });
  }

  private Mono<AgentToolResult> completeFromWorkerResult(
      AgentRuntimeRequest runtimeRequest,
      AgentToolCall toolCall,
      AgentToolDescriptor descriptor,
      WorkerExecutionResult workerResult) {
    StoredWorkflowStatus storedStatus = workerResult.status() == WorkerExecutionStatus.SUCCEEDED
        ? StoredWorkflowStatus.SUCCEEDED
        : StoredWorkflowStatus.FAILED_TERMINAL;
    String resultStatus = switch (workerResult.status()) {
      case SUCCEEDED -> "SUCCEEDED";
      case REJECTED -> "REJECTED";
      case FAILED -> "FAILED";
    };
    return agentWorkflowStore.markToolStepCompleted(
            runtimeRequest.workspaceId(),
            runtimeRequest.workflowId(),
            toolCall.stepSequence(),
            storedStatus,
            workerResult.errorCode(),
            workerResult.errorMessage(),
            workerResult.completedAt())
        .then(appendToolCompletedEvent(
            runtimeRequest,
            toolCall,
            descriptor.skillId(),
            descriptor.version(),
            workerResult.status() == WorkerExecutionStatus.SUCCEEDED ? "SUCCEEDED" : "FAILED",
            workerResult.outputSchemaId(),
            workerResult.completedAt()))
        .thenReturn(new AgentToolResult(
            "1.0",
            toolCall.toolCallId(),
            runtimeRequest.taskId(),
            runtimeRequest.workflowId(),
            resultStatus,
            workerResult.outputSchemaId(),
            safeOutput(workerResult.output()),
            workerResult.errorCode(),
            workerResult.errorMessage(),
            workerResult.completedAt()));
  }

  private Mono<AgentToolResult> completeAfterWorkerFailure(
      AgentRuntimeRequest runtimeRequest,
      AgentToolCall toolCall,
      AgentToolDescriptor descriptor,
      String errorCode,
      String errorMessage) {
    OffsetDateTime completedAt = OffsetDateTime.now(clock);
    return agentWorkflowStore.markToolStepCompleted(
            runtimeRequest.workspaceId(),
            runtimeRequest.workflowId(),
            toolCall.stepSequence(),
            StoredWorkflowStatus.FAILED_TERMINAL,
            errorCode,
            errorMessage,
            completedAt)
        .then(appendToolCompletedEvent(
            runtimeRequest,
            toolCall,
            descriptor.skillId(),
            descriptor.version(),
            "FAILED",
            descriptor.outputSchemaId(),
            completedAt))
        .thenReturn(rejectedResult(
            runtimeRequest,
            toolCall,
            descriptor.outputSchemaId(),
            "FAILED",
            errorCode,
            errorMessage,
            completedAt));
  }

  private Mono<AgentToolResult> rejectWithRecordedStep(
      AgentRuntimeRequest runtimeRequest,
      AgentToolCall toolCall,
      String outputSchemaId,
      String parametersHash,
      String policyDecisionId,
      String errorCode,
      String errorMessage) {
    OffsetDateTime requestedAt = OffsetDateTime.now(clock);
    StoredAgentToolStep step = new StoredAgentToolStep(
        runtimeRequest.workflowId(),
        runtimeRequest.workspaceId(),
        toolCall.stepSequence(),
        toolCall.toolCallId(),
        toolCall.skill().skillId(),
        toolCall.skill().version(),
        parametersHash,
        policyDecisionId,
        StoredWorkflowStatus.RUNNING,
        requestedAt,
        null,
        null,
        null);
    return recordToolAudit(
            runtimeRequest,
            toolCall,
            policyDecisionService.policyVersion(),
            "DENY",
            errorMessage,
            requestedAt)
        .then(agentWorkflowStore.appendToolStep(step))
        .then(appendToolRequestedEvent(
            runtimeRequest,
            toolCall,
            toolCall.skill().skillId(),
            toolCall.skill().version(),
            toolCall.skill().parameterSchemaId(),
            parametersHash,
            requestedAt))
        .then(agentWorkflowStore.markToolStepCompleted(
            runtimeRequest.workspaceId(),
            runtimeRequest.workflowId(),
            toolCall.stepSequence(),
            StoredWorkflowStatus.FAILED_TERMINAL,
            errorCode,
            errorMessage,
            requestedAt))
        .then(appendToolRejectedEvent(
            runtimeRequest,
            toolCall,
            errorCode,
            errorMessage,
            policyDecisionId,
            requestedAt))
        .thenReturn(rejectedResult(
            runtimeRequest,
            toolCall,
            outputSchemaId,
            "REJECTED",
            errorCode,
            errorMessage,
            requestedAt));
  }

  private StoredAgentToolStep runningStep(
      AgentRuntimeRequest runtimeRequest,
      AgentToolCall toolCall,
      AgentToolDescriptor descriptor,
      String parametersHash,
      String policyDecisionId,
      OffsetDateTime requestedAt) {
    return new StoredAgentToolStep(
        runtimeRequest.workflowId(),
        runtimeRequest.workspaceId(),
        toolCall.stepSequence(),
        toolCall.toolCallId(),
        descriptor.skillId(),
        descriptor.version(),
        parametersHash,
        policyDecisionId,
        StoredWorkflowStatus.RUNNING,
        requestedAt,
        null,
        null,
        null);
  }

  private AgentToolResult rejectedResult(
      AgentRuntimeRequest runtimeRequest,
      AgentToolCall toolCall,
      String outputSchemaId,
      String status,
      String errorCode,
      String errorMessage,
      OffsetDateTime completedAt) {
    return new AgentToolResult(
        "1.0",
        toolCall.toolCallId(),
        runtimeRequest.taskId(),
        runtimeRequest.workflowId(),
        status,
        outputSchemaId,
        objectMapper.createObjectNode(),
        errorCode,
        errorMessage,
        completedAt);
  }

  private JsonNode safeOutput(JsonNode output) {
    return output == null ? objectMapper.createObjectNode() : output;
  }

  /**
   * 记录 Agent Tool 内部授权审计。
   *
   * <p>文件审计实现包含阻塞 I/O，因此这里和入口过滤器一样切换到 boundedElastic。
   * 审计记录串在 Worker 调用之前，避免出现授权结果未落审计但命令已经下发的路径。
   */
  private Mono<Void> recordToolAudit(
      AgentRuntimeRequest runtimeRequest,
      AgentToolCall toolCall,
      String policyVersion,
      String result,
      String reason,
      OffsetDateTime timestamp) {
    AuditEvent event = new AuditEvent(
        UUID.randomUUID().toString(),
        runtimeRequest.requestId(),
        runtimeRequest.traceId(),
        runtimeRequest.operatorId(),
        ACTION_EXECUTE_AGENT_TOOL,
        toolCall.skill().skillId() + ":" + toolCall.skill().version(),
        policyVersion,
        result,
        reason,
        timestamp);
    return Mono.fromRunnable(() -> auditTrail.record(event))
        .subscribeOn(Schedulers.boundedElastic())
        .then();
  }

  private Mono<Void> appendToolRequestedEvent(
      AgentRuntimeRequest runtimeRequest,
      AgentToolCall toolCall,
      String skillId,
      String skillVersion,
      String parameterSchemaId,
      String parametersHash,
      OffsetDateTime timestamp) {
    return appendSemanticEvent(
        runtimeRequest.workflowId(),
        requestedEventSequence(toolCall),
        timestamp,
        SemanticEventType.AGENT_TOOL_CALL_REQUESTED,
        new AgentToolCallRequestedPayload(
            SemanticEventType.AGENT_TOOL_CALL_REQUESTED,
            toolCall.toolCallId(),
            toolCall.stepSequence(),
            skillId,
            skillVersion,
            parameterSchemaId,
            runtimeRequest.targetEnvironment(),
            parametersHash));
  }

  private Mono<Void> appendToolCompletedEvent(
      AgentRuntimeRequest runtimeRequest,
      AgentToolCall toolCall,
      String skillId,
      String skillVersion,
      String status,
      String outputSchemaId,
      OffsetDateTime timestamp) {
    return appendSemanticEvent(
        runtimeRequest.workflowId(),
        terminalEventSequence(toolCall),
        timestamp,
        SemanticEventType.AGENT_TOOL_CALL_COMPLETED,
        new AgentToolCallCompletedPayload(
            SemanticEventType.AGENT_TOOL_CALL_COMPLETED,
            toolCall.toolCallId(),
            toolCall.stepSequence(),
            skillId,
            skillVersion,
            status,
            outputSchemaId));
  }

  private Mono<Void> appendToolRejectedEvent(
      AgentRuntimeRequest runtimeRequest,
      AgentToolCall toolCall,
      String errorCode,
      String errorMessage,
      String policyDecisionId,
      OffsetDateTime timestamp) {
    return appendSemanticEvent(
        runtimeRequest.workflowId(),
        terminalEventSequence(toolCall),
        timestamp,
        SemanticEventType.AGENT_TOOL_CALL_REJECTED,
        new AgentToolCallRejectedPayload(
            SemanticEventType.AGENT_TOOL_CALL_REJECTED,
            toolCall.toolCallId(),
            toolCall.stepSequence(),
            toolCall.skill().skillId(),
            toolCall.skill().version(),
            errorCode,
            errorMessage,
            policyDecisionId));
  }

  private Mono<Void> appendSemanticEvent(
      String workflowId,
      long sequence,
      OffsetDateTime timestamp,
      SemanticEventType type,
      SemanticEventPayload payload) {
    return eventStore.appendEvent(
        workflowId,
        sequence,
        new SemanticEvent(
            "1.0",
            UUID.randomUUID().toString(),
            workflowId,
            sequence,
            timestamp,
            type,
            payload));
  }

  /**
   * Agent Tool 的 stepSequence 是模型工具调用序号；语义事件需要独立递增序号。
   * 当前每个 Tool Step 固定占用两个事件槽位：请求事件和终态事件。
   */
  private long requestedEventSequence(AgentToolCall toolCall) {
    return toolCall.stepSequence() * 2 - 1;
  }

  private long terminalEventSequence(AgentToolCall toolCall) {
    return toolCall.stepSequence() * 2;
  }

  /**
   * 对参数做服务端稳定哈希，避免使用 ToolCall 中可能被模型或客户端伪造的 parametersHash。
   */
  private String serverParametersHash(Map<String, String> parameters) {
    try {
      byte[] canonicalJson = objectMapper.writeValueAsBytes(new TreeMap<>(parameters));
      return "sha256:" + HexFormat.of().formatHex(sha256().digest(canonicalJson));
    } catch (JsonProcessingException exception) {
      throw new IllegalArgumentException("tool parameters must be serializable", exception);
    }
  }

  private MessageDigest sha256() {
    try {
      return MessageDigest.getInstance("SHA-256");
    } catch (NoSuchAlgorithmException exception) {
      throw new IllegalStateException("SHA-256 digest is unavailable", exception);
    }
  }

  private String contextMismatch(AgentRuntimeRequest runtimeRequest, AgentToolCall toolCall) {
    if (!runtimeRequest.taskId().equals(toolCall.taskId())) {
      return "tool call task does not match runtime task";
    }
    if (!runtimeRequest.workflowId().equals(toolCall.workflowId())) {
      return "tool call workflow does not match runtime workflow";
    }
    if (!runtimeRequest.targetEnvironment().equals(toolCall.targetEnvironment())) {
      return "tool call target environment does not match runtime target environment";
    }
    return null;
  }

  private String policyDecisionId(
      PolicyDecision decision,
      AgentRuntimeRequest runtimeRequest,
      AgentToolCall toolCall) {
    return decision.policyVersion() + ":" + runtimeRequest.workflowId() + ":" + toolCall.toolCallId()
        + ":" + toolCall.stepSequence();
  }

  private String platformDecisionId(
      AgentRuntimeRequest runtimeRequest,
      AgentToolCall toolCall,
      String reasonCode) {
    return policyDecisionService.policyVersion() + ":" + runtimeRequest.workflowId() + ":"
        + toolCall.toolCallId() + ":" + toolCall.stepSequence() + ":" + reasonCode;
  }

  private String executionRequestId(AgentRuntimeRequest runtimeRequest, AgentToolCall toolCall) {
    return "agent-tool:" + runtimeRequest.workflowId() + ":" + toolCall.stepSequence() + ":"
        + toolCall.toolCallId();
  }
}
