package com.company.opsagent.executionworker;

/**
 * Worker 本地 SQL 连接目录项，只保存连接元数据和凭据别名，不保存真实密钥。
 */
public record WorkerSqlConnectionDescriptor(
    String connectionId,
    String targetEnvironment,
    String host,
    int port,
    String credentialAlias,
    boolean enabled) {

  public WorkerSqlConnectionDescriptor {
    connectionId = requiredText(connectionId, "connectionId");
    targetEnvironment = requiredText(targetEnvironment, "targetEnvironment").toLowerCase();
    if (!"development".equals(targetEnvironment) && !"test".equals(targetEnvironment)) {
      throw new IllegalArgumentException("targetEnvironment must be development or test");
    }
    host = requiredText(host, "host").toLowerCase();
    if (port < 1 || port > 65535) {
      throw new IllegalArgumentException("port must be between 1 and 65535");
    }
    credentialAlias = requiredText(credentialAlias, "credentialAlias");
  }

  public WorkerSqlEgressTarget target() {
    return new WorkerSqlEgressTarget(host, port);
  }

  private static String requiredText(String value, String name) {
    if (value == null || value.isBlank()) {
      throw new IllegalArgumentException(name + " is required");
    }
    return value.trim();
  }
}
