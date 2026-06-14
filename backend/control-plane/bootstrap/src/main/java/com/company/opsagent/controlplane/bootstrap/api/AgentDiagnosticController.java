package com.company.opsagent.controlplane.bootstrap.api;

import com.company.opsagent.contracts.agent.AgentTaskRequest;
import com.company.opsagent.contracts.agent.AgentTaskResult;
import com.company.opsagent.contracts.workflow.OperatorContext;
import com.company.opsagent.contracts.workflow.PolicyDecisionReference;
import com.company.opsagent.contracts.workflow.TraceContext;
import com.company.opsagent.contracts.workflow.WorkspaceContext;
import com.company.opsagent.controlplane.bootstrap.config.AgentRuntimeProperties;
import com.company.opsagent.controlplane.bootstrap.security.PolicyEnforcementWebFilter;
import com.company.opsagent.controlplane.modules.audit.ExecutionContext;
import com.company.opsagent.controlplane.modules.workflow.AgentDiagnosticWorkflowService;
import java.time.OffsetDateTime;
import java.util.Map;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ServerWebExchange;
import reactor.core.publisher.Mono;

/**
 * Protected primary Agent diagnostic entrypoint.
 */
@RestController
@RequestMapping({"/internal/agent", "/api/v1/agent"})
public class AgentDiagnosticController {

  private final AgentDiagnosticWorkflowService workflowService;
  private final AgentRuntimeProperties properties;

  public AgentDiagnosticController(
      AgentDiagnosticWorkflowService workflowService,
      AgentRuntimeProperties properties) {
    this.workflowService = workflowService;
    this.properties = properties;
  }

  @PostMapping("/diagnostics")
  public Mono<ResponseEntity<?>> execute(
      @RequestBody AgentDiagnosticRequest request,
      ServerWebExchange exchange) {
    if (!properties.isEnabled()) {
      return Mono.just(ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE)
          .body(error("AGENT_RUNTIME_DISABLED", "Agent runtime is disabled for this environment.", exchange)));
    }
    return workflowService.execute(toTaskRequest(request, exchange))
        .map(ResponseEntity::ok);
  }

  private AgentTaskRequest toTaskRequest(
      AgentDiagnosticRequest request,
      ServerWebExchange exchange) {
    ExecutionContext context = exchange.getRequiredAttribute(
        PolicyEnforcementWebFilter.EXECUTION_CONTEXT_ATTRIBUTE);
    return new AgentTaskRequest(
        "1.0",
        UUID.randomUUID().toString(),
        request.idempotencyKey(),
        new WorkspaceContext(
            properties.getWorkspaceId(),
            properties.getWorkspaceCode(),
            properties.getWorkspaceDisplayName()),
        new OperatorContext(context.subject(), context.roles()),
        request.targetEnvironment(),
        request.userIntent(),
        request.inputParameters() == null ? Map.of() : request.inputParameters(),
        new PolicyDecisionReference(context.requestId() + ":" + context.action(), context.policyVersion(), "ALLOW"),
        new TraceContext(context.traceId(), context.requestId()),
        OffsetDateTime.now());
  }

  private ApiError error(
      String code,
      String message,
      ServerWebExchange exchange) {
    return new ApiError(
        code,
        message,
        exchange.getRequest().getPath().value(),
        exchange.getRequest().getId(),
        OffsetDateTime.now());
  }
}
