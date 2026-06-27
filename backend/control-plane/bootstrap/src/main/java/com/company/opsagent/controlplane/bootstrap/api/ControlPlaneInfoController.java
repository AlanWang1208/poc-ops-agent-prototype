package com.company.opsagent.controlplane.bootstrap.api;

import com.company.opsagent.controlplane.bootstrap.config.ControlPlaneProperties;
import com.company.opsagent.controlplane.modules.audit.AuditEvent;
import com.company.opsagent.controlplane.modules.audit.AuditTrail;
import com.company.opsagent.controlplane.bootstrap.service.ModuleCatalogService;
import jakarta.validation.constraints.NotBlank;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import reactor.core.publisher.Mono;

/**
 * 控制面内部信息接口。
 *
 * <p>当前提供模块清单、健康检查、回显、异常探针和最新审计查询等骨架接口，
 * 主要用于验证服务框架、权限控制和审计链路是否打通。
 */
@Validated
@RestController
@RequestMapping("/internal")
public class ControlPlaneInfoController {

  private final ModuleCatalogService moduleCatalogService;
  private final ControlPlaneProperties properties;
  private final AuditTrail auditTrail;

  public ControlPlaneInfoController(
      ModuleCatalogService moduleCatalogService,
      ControlPlaneProperties properties,
      AuditTrail auditTrail) {
    this.moduleCatalogService = moduleCatalogService;
    this.properties = properties;
    this.auditTrail = auditTrail;
  }

  /**
   * 返回控制面模块清单。
   */
  @GetMapping("/modules")
  public Mono<ModuleManifestResponse> modules() {
    return Mono.just(new ModuleManifestResponse(
        properties.serviceName(),
        properties.apiVersion(),
        moduleCatalogService.moduleIds()));
  }

  /**
   * 返回服务健康状态。
   */
  @GetMapping("/healthz")
  public Mono<HealthResponse> healthz() {
    return Mono.just(new HealthResponse(
        "UP",
        properties.serviceName(),
        properties.apiVersion(),
        moduleCatalogService.moduleIds(),
        OffsetDateTime.now()));
  }

  /**
   * 回显请求参数，主要用于验证基本的参数校验与请求通路。
   */
  @GetMapping("/echo")
  public Mono<EchoResponse> echo(@RequestParam("value") @NotBlank String value) {
    return Mono.just(new EchoResponse(value));
  }

  /**
   * 主动抛出非法参数异常，供异常处理链和权限链路测试使用。
   */
  @GetMapping("/failures/illegal-argument")
  public Mono<Void> illegalArgument() {
    throw new IllegalArgumentException("illegal argument for skeleton verification");
  }

  /**
   * 返回最新一条审计事件及当前审计总量。
   */
  @GetMapping("/audit/latest")
  public Mono<Map<String, Object>> latestAuditEvent() {
    AuditEvent latest = auditTrail.latest()
        .orElseThrow(() -> new IllegalArgumentException("no audit event recorded yet"));
    return Mono.just(Map.of(
        "count", auditTrail.snapshot().size(),
        "latest", latest));
  }

  /**
   * 返回最近的审计事件，按最新事件优先排序。
   */
  @GetMapping("/audit/events")
  public Mono<AuditEventsResponse> recentAuditEvents(
      @RequestParam(name = "limit", defaultValue = "50") int limit) {
    List<AuditEvent> snapshot = auditTrail.snapshot();
    int boundedLimit = Math.max(1, Math.min(limit, 200));
    List<AuditEvent> recent = new ArrayList<>();
    for (int index = snapshot.size() - 1; index >= 0 && recent.size() < boundedLimit; index--) {
      recent.add(snapshot.get(index));
    }
    return Mono.just(new AuditEventsResponse(snapshot.size(), recent));
  }

  public record AuditEventsResponse(
      int total,
      List<AuditEvent> events) {
  }
}
