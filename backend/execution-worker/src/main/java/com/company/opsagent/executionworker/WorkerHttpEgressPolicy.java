package com.company.opsagent.executionworker;

import java.net.URI;
import java.util.List;
import java.util.Set;

/**
 * Worker 本地 HTTP 出口策略，只允许配置中明确列出的 scheme、host 和 port。
 */
public final class WorkerHttpEgressPolicy {

  private final Set<WorkerHttpEgressTarget> allowedTargets;

  public WorkerHttpEgressPolicy(List<WorkerHttpEgressTarget> allowedTargets) {
    this.allowedTargets = Set.copyOf(allowedTargets);
  }

  public WorkerHttpEgressTarget validate(URI endpoint) {
    if (endpoint == null) {
      throw rejected("HTTP_EGRESS_ENDPOINT_INVALID", "HTTP endpoint is required");
    }
    String scheme = endpoint.getScheme();
    if (!"http".equalsIgnoreCase(scheme) && !"https".equalsIgnoreCase(scheme)) {
      throw rejected("HTTP_EGRESS_SCHEME_NOT_ALLOWED", "HTTP egress scheme is not allowed");
    }
    if (endpoint.getUserInfo() != null) {
      throw rejected("HTTP_EGRESS_USERINFO_NOT_ALLOWED", "HTTP endpoint must not contain user info");
    }
    String host = endpoint.getHost();
    if (host == null || host.isBlank()) {
      throw rejected("HTTP_EGRESS_HOST_REQUIRED", "HTTP endpoint host is required");
    }
    int port = endpoint.getPort() == -1 ? WorkerHttpEgressTarget.defaultPort(scheme) : endpoint.getPort();
    WorkerHttpEgressTarget target = new WorkerHttpEgressTarget(scheme, host, port);
    if (!allowedTargets.contains(target)) {
      throw rejected("HTTP_EGRESS_NOT_ALLOWED", "HTTP egress target is not allowed for this worker");
    }
    return target;
  }

  private static WorkerHttpEgressException rejected(String errorCode, String safeMessage) {
    return new WorkerHttpEgressException(errorCode, safeMessage);
  }
}
