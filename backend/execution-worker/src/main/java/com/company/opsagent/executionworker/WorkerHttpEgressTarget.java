package com.company.opsagent.executionworker;

/**
 * Worker 允许访问的单个 HTTP 网络出口目标。
 */
public record WorkerHttpEgressTarget(String scheme, String host, int port) {

  public WorkerHttpEgressTarget {
    scheme = requiredText(scheme, "scheme").toLowerCase();
    host = requiredText(host, "host").toLowerCase();
    if (!"http".equals(scheme) && !"https".equals(scheme)) {
      throw new IllegalArgumentException("scheme must be http or https");
    }
    if (port < 1 || port > 65535) {
      throw new IllegalArgumentException("port must be between 1 and 65535");
    }
  }

  static int defaultPort(String scheme) {
    return "https".equalsIgnoreCase(scheme) ? 443 : 80;
  }

  private static String requiredText(String value, String name) {
    if (value == null || value.isBlank()) {
      throw new IllegalArgumentException(name + " is required");
    }
    return value.trim();
  }
}
