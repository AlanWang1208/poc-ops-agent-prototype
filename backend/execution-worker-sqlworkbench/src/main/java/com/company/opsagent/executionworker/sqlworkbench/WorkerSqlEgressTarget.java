package com.company.opsagent.executionworker.sqlworkbench;

/**
 * Worker 允许访问的单个 SQL 网络出口目标。
 */
public record WorkerSqlEgressTarget(String host, int port) {

  public WorkerSqlEgressTarget {
    host = requiredText(host, "host").toLowerCase();
    if (port < 1 || port > 65535) {
      throw new IllegalArgumentException("port must be between 1 and 65535");
    }
  }

  private static String requiredText(String value, String name) {
    if (value == null || value.isBlank()) {
      throw new IllegalArgumentException(name + " is required");
    }
    return value.trim();
  }
}
