package com.company.opsagent.controlplane.bootstrap.api;

import com.company.opsagent.contracts.workflow.OperatorContext;
import com.company.opsagent.contracts.workflow.PolicyDecisionReference;
import com.company.opsagent.contracts.workflow.TraceContext;
import com.company.opsagent.contracts.events.SemanticEvent;
import com.company.opsagent.controlplane.bootstrap.security.PolicyEnforcementWebFilter;
import com.company.opsagent.controlplane.modules.audit.ExecutionContext;
import com.company.opsagent.controlplane.modules.workflow.ReadOnlyDiagnosticWorkflowService;
import com.company.opsagent.controlplane.modules.workflow.ReadOnlyWorkflowRequest;
import com.company.opsagent.controlplane.modules.workflow.ReadOnlyWorkflowResult;
import com.company.opsagent.controlplane.modules.workflow.ReadOnlyWorkflowStore;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.http.MediaType;
import org.springframework.http.codec.ServerSentEvent;
import org.springframework.web.server.ServerWebExchange;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

/**
 * 受服务端策略和审计保护的只读诊断入口。
 */
@RestController
@RequestMapping("/internal/diagnostics")
public class ReadOnlyDiagnosticController {

  private final ReadOnlyDiagnosticWorkflowService workflowService;
  private final ReadOnlyWorkflowStore workflowStore;

  public ReadOnlyDiagnosticController(
      ReadOnlyDiagnosticWorkflowService workflowService,
      ReadOnlyWorkflowStore workflowStore) {
    this.workflowService = workflowService;
    this.workflowStore = workflowStore;
  }

  /**
   * 将已授权请求路由到独立 Worker，并返回结果与完整语义事件。
   */
  @PostMapping("/read-only")
  public Mono<ReadOnlyWorkflowResult> execute(
      @RequestBody ReadOnlyDiagnosticRequest request,
      ServerWebExchange exchange) {
    return workflowService.execute(toWorkflowRequest(request, exchange));
  }

  /**
   * 以 SSE 形式输出强类型语义事件，供只读操作台按事件类型渲染。
   */
  @PostMapping(value = "/read-only/events", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
  public Flux<ServerSentEvent<SemanticEvent>> events(
      @RequestBody ReadOnlyDiagnosticRequest request,
      ServerWebExchange exchange) {
    return workflowService.execute(toWorkflowRequest(request, exchange))
        .flatMapMany(result -> Flux.fromIterable(result.events()))
        .map(event -> ServerSentEvent.<SemanticEvent>builder()
            .id(event.eventId())
            .event(event.type().name())
            .data(event)
            .build());
  }

  @GetMapping(value = "/read-only/workflows/{workflowId}/events", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
  public Flux<ServerSentEvent<SemanticEvent>> resumeEvents(
      @PathVariable("workflowId") String workflowId,
      @RequestParam(name = "afterSequence", defaultValue = "0") long afterSequence) {
    return workflowStore.loadEventsAfter(workflowId, afterSequence)
        .map(event -> ServerSentEvent.<SemanticEvent>builder()
            .id(event.eventId())
            .event(event.type().name())
            .data(event)
            .build());
  }

  private ReadOnlyWorkflowRequest toWorkflowRequest(
      ReadOnlyDiagnosticRequest request,
      ServerWebExchange exchange) {
    ExecutionContext context = exchange.getRequiredAttribute(
        PolicyEnforcementWebFilter.EXECUTION_CONTEXT_ATTRIBUTE);
    return new ReadOnlyWorkflowRequest(
        request.skillId(),
        request.targetEnvironment(),
        request.idempotencyKey(),
        request.parameters(),
        new OperatorContext(context.subject(), context.roles()),
        new PolicyDecisionReference(context.requestId() + ":" + context.action(), context.policyVersion(), "ALLOW"),
        new TraceContext(context.traceId(), context.requestId()));
  }
}
