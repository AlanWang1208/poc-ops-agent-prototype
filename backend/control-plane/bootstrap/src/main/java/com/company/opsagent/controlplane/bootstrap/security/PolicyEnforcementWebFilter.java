package com.company.opsagent.controlplane.bootstrap.security;

import com.company.opsagent.controlplane.bootstrap.api.ApiErrorResponseWriter;
import com.company.opsagent.controlplane.modules.audit.AuditEvent;
import com.company.opsagent.controlplane.modules.audit.AuditTrail;
import com.company.opsagent.controlplane.modules.audit.ExecutionContext;
import com.company.opsagent.controlplane.modules.identity.OperatorIdentity;
import com.company.opsagent.controlplane.modules.identity.api.IdentitySessionQueryService;
import com.company.opsagent.controlplane.modules.policy.PolicyDecision;
import com.company.opsagent.controlplane.modules.policy.PolicyDecisionService;
import java.time.OffsetDateTime;
import java.util.Optional;
import java.util.UUID;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ServerWebExchange;
import org.springframework.web.server.WebFilter;
import org.springframework.web.server.WebFilterChain;
import reactor.core.publisher.Mono;
import reactor.core.scheduler.Schedulers;

/**
 * 控制面内部接口的统一认证、授权与审计过滤器。
 *
 * <p>该过滤器只接管 `/internal/**` 路径，并在一次请求中完成：
 * 1. Bearer Token 提取与认证；
 * 2. 动作映射与策略决策；
 * 3. 执行上下文注入；
 * 4. 审计事件记录；
 * 5. 统一错误响应输出。
 */
public class PolicyEnforcementWebFilter implements WebFilter {

  public static final String EXECUTION_CONTEXT_ATTRIBUTE = "ops-agent.execution-context";

  private final PolicyDecisionService policyDecisionService;
  private final AuditTrail auditTrail;
  private final ApiErrorResponseWriter errorResponseWriter;
  private final OperatorIdentityAuthenticator operatorIdentityAuthenticator;
  private final AuthenticatedPrincipalOperatorIdentityResolver authenticatedPrincipalOperatorIdentityResolver;
  private final IdentitySessionQueryService identitySessionQueryService;
  private final String sessionCookieName;

  public PolicyEnforcementWebFilter(
      PolicyDecisionService policyDecisionService,
      AuditTrail auditTrail,
      ApiErrorResponseWriter errorResponseWriter,
      OperatorIdentityAuthenticator operatorIdentityAuthenticator,
      AuthenticatedPrincipalOperatorIdentityResolver authenticatedPrincipalOperatorIdentityResolver,
      IdentitySessionQueryService identitySessionQueryService,
      String sessionCookieName) {
    this.policyDecisionService = policyDecisionService;
    this.auditTrail = auditTrail;
    this.errorResponseWriter = errorResponseWriter;
    this.operatorIdentityAuthenticator = operatorIdentityAuthenticator;
    this.authenticatedPrincipalOperatorIdentityResolver = authenticatedPrincipalOperatorIdentityResolver;
    this.identitySessionQueryService = identitySessionQueryService;
    this.sessionCookieName = sessionCookieName;
  }

  /**
   * 过滤器主入口。
   *
   * <p>非内部接口直接放行；内部接口必须完成认证与授权后才继续向下执行。
   */
  @Override
  public Mono<Void> filter(ServerWebExchange exchange, WebFilterChain chain) {
    String path = exchange.getRequest().getPath().value();
    if (!requiresPolicy(path)) {
      return chain.filter(exchange);
    }
    return authenticate(exchange)
        .flatMap(operatorIdentity -> authorize(exchange, chain, operatorIdentity).thenReturn(Boolean.TRUE))
        .defaultIfEmpty(Boolean.FALSE)
        .flatMap(authorized -> authorized ? Mono.empty() : denyWithoutPrincipal(exchange));
  }

  private boolean requiresPolicy(String path) {
    return path.startsWith("/internal/") || "/api/v1/agent/diagnostics".equals(path);
  }

  /**
   * 对已认证主体执行动作映射、策略判断和审计记录。
   */
  private Mono<Void> authorize(
      ServerWebExchange exchange,
      WebFilterChain chain,
      OperatorIdentity principal) {
    ActionDescriptor descriptor = ActionDescriptor.resolve(
        exchange.getRequest().getMethod(),
        exchange.getRequest().getPath().value());
    if (descriptor == null) {
      record(exchange, principal.subject(), "internal.unknown", exchange.getRequest().getPath().value(), policyDecisionService.policyVersion(), "DENY", "no action mapping");
      return errorResponseWriter.write(exchange, HttpStatus.FORBIDDEN, "POLICY_DENIED", "no policy rule for request");
    }
    PolicyDecision decision = policyDecisionService.decide(principal, descriptor.action(), descriptor.resource());
    ExecutionContext executionContext = new ExecutionContext(
        exchange.getRequest().getId(),
        traceId(exchange),
        principal.subject(),
        principal.username(),
        principal.roles(),
        descriptor.action(),
        descriptor.resource(),
        exchange.getRequest().getMethod().name(),
        exchange.getRequest().getPath().value(),
        decision.policyVersion());
    exchange.getAttributes().put(EXECUTION_CONTEXT_ATTRIBUTE, executionContext);
    record(exchange, principal.subject(), descriptor.action(), descriptor.resource(), decision.policyVersion(), decision.allowed() ? "ALLOW" : "DENY", decision.reason());
    if (!decision.allowed()) {
      return errorResponseWriter.write(exchange, HttpStatus.FORBIDDEN, "POLICY_DENIED", decision.reason());
    }
    return chain.filter(exchange);
  }

  /**
   * 从请求头中提取 Bearer Token 并委托认证器校验。
   */
  private Mono<OperatorIdentity> authenticate(ServerWebExchange exchange) {
    return authenticateWithBearerToken(exchange)
        .switchIfEmpty(authenticateWithBuiltInSession(exchange))
        .switchIfEmpty(authenticatedPrincipalOperatorIdentityResolver.resolve(exchange));
  }

  private Mono<OperatorIdentity> authenticateWithBuiltInSession(ServerWebExchange exchange) {
    if (identitySessionQueryService == null) {
      return Mono.empty();
    }
    var cookie = exchange.getRequest().getCookies().getFirst(sessionCookieName);
    if (cookie == null || cookie.getValue() == null || cookie.getValue().isBlank()) {
      return Mono.empty();
    }
    return Mono.fromCallable(() -> identitySessionQueryService.findOperatorIdentityBySessionId(cookie.getValue()))
        .subscribeOn(Schedulers.boundedElastic())
        .flatMap(Mono::justOrEmpty);
  }

  private Mono<OperatorIdentity> authenticateWithBearerToken(ServerWebExchange exchange) {
    String authorization = exchange.getRequest().getHeaders().getFirst("Authorization");
    if (authorization == null || !authorization.startsWith("Bearer ")) {
      return Mono.empty();
    }
    String token = authorization.substring("Bearer ".length()).trim();
    if (token.isEmpty()) {
      return Mono.empty();
    }
    return operatorIdentityAuthenticator.authenticate(token);
  }

  /**
   * 在缺失或无效主体时写出统一未认证响应，并记录拒绝审计。
   */
  private Mono<Void> denyWithoutPrincipal(ServerWebExchange exchange) {
    String path = exchange.getRequest().getPath().value();
    ActionDescriptor descriptor = Optional.ofNullable(ActionDescriptor.resolve(exchange.getRequest().getMethod(), path))
        .orElse(new ActionDescriptor("internal.unknown", path));
    record(exchange, "anonymous", descriptor.action(), descriptor.resource(), policyDecisionService.policyVersion(), "DENY", "missing authenticated principal");
    return errorResponseWriter.write(exchange, HttpStatus.UNAUTHORIZED, "UNAUTHENTICATED", "missing or invalid authentication");
  }

  /**
   * 记录一条审计事件。
   */
  private void record(
      ServerWebExchange exchange,
      String subject,
      String action,
      String resource,
      String policyVersion,
      String result,
      String reason) {
    auditTrail.record(new AuditEvent(
        UUID.randomUUID().toString(),
        exchange.getRequest().getId(),
        traceId(exchange),
        subject,
        action,
        resource,
        policyVersion,
        result,
        reason,
        OffsetDateTime.now()));
  }

  /**
   * 返回当前请求可追踪的 traceId。
   *
   * <p>优先使用调用方显式传入的 `X-Trace-Id`，否则回退到服务侧请求 ID。
   */
  private String traceId(ServerWebExchange exchange) {
    return Optional.ofNullable(exchange.getRequest().getHeaders().getFirst("X-Trace-Id"))
        .filter(value -> !value.isBlank())
        .orElse(exchange.getRequest().getId());
  }

  /**
   * 请求动作描述。
   *
   * @param action 与策略规则匹配的动作标识
   * @param resource 当前访问资源路径
   */
  private record ActionDescriptor(String action, String resource) {

    /**
     * 把 HTTP 方法和路径解析为内部策略动作。
     */
    private static ActionDescriptor resolve(HttpMethod method, String path) {
      if (method == HttpMethod.GET && "/internal/healthz".equals(path)) {
        return new ActionDescriptor("internal.health.read", path);
      }
      if (method == HttpMethod.GET && "/internal/modules".equals(path)) {
        return new ActionDescriptor("internal.modules.read", path);
      }
      if (method == HttpMethod.GET && "/internal/echo".equals(path)) {
        return new ActionDescriptor("internal.echo.read", path);
      }
      if (method == HttpMethod.GET && "/internal/failures/illegal-argument".equals(path)) {
        return new ActionDescriptor("internal.failures.read", path);
      }
      if (method == HttpMethod.GET && "/internal/audit/latest".equals(path)) {
        return new ActionDescriptor("internal.audit.read", path);
      }
      if (method == HttpMethod.GET && "/internal/skills".equals(path)) {
        return new ActionDescriptor("internal.skills.read", path);
      }
      if (method == HttpMethod.GET && path.startsWith("/internal/skills/")) {
        return new ActionDescriptor("internal.skills.read", path);
      }
      if (method == HttpMethod.POST && "/internal/skills/publications/validate".equals(path)) {
        return new ActionDescriptor("internal.skills.publish.validate", path);
      }
      if (method == HttpMethod.POST && "/internal/routing/skills/search".equals(path)) {
        return new ActionDescriptor("internal.routing.skills.read", path);
      }
      if (method == HttpMethod.POST && "/internal/diagnostics/read-only".equals(path)) {
        return new ActionDescriptor("internal.diagnostics.read", path);
      }
      if (method == HttpMethod.POST && "/internal/diagnostics/read-only/events".equals(path)) {
        return new ActionDescriptor("internal.diagnostics.read", path);
      }
      if (method == HttpMethod.POST && "/internal/agent/diagnostics".equals(path)) {
        return new ActionDescriptor("internal.agent.diagnostics.read", path);
      }
      if (method == HttpMethod.POST && "/api/v1/agent/diagnostics".equals(path)) {
        return new ActionDescriptor("internal.agent.diagnostics.read", path);
      }
      if (method == HttpMethod.POST && "/internal/identity/password-reset".equals(path)) {
        return new ActionDescriptor("internal.identity.password-reset", path);
      }
      if (method == HttpMethod.GET && path.startsWith("/internal/diagnostics/read-only/workflows/")
          && path.endsWith("/events")) {
        return new ActionDescriptor("internal.diagnostics.read", path);
      }
      return null;
    }
  }
}
