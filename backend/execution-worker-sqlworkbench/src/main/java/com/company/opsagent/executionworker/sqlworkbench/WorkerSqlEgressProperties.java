package com.company.opsagent.executionworker.sqlworkbench;

import java.util.List;
import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * Worker 本地 SQL 出口 allowlist 配置。
 */
@ConfigurationProperties(prefix = "ops-agent.worker.sql-egress")
public class WorkerSqlEgressProperties {

  private List<Target> allowedTargets = List.of();
  private List<Connection> connections = List.of();

  /**
   * Worker 允许访问的 SQL 主机和端口列表。
   */
  public List<Target> getAllowedTargets() {
    return allowedTargets;
  }

  public void setAllowedTargets(List<Target> allowedTargets) {
    this.allowedTargets = allowedTargets == null ? List.of() : List.copyOf(allowedTargets);
  }

  /**
   * Worker 本地 SQL 连接目录。
   */
  public List<Connection> getConnections() {
    return connections;
  }

  public void setConnections(List<Connection> connections) {
    this.connections = connections == null ? List.of() : List.copyOf(connections);
  }

  public WorkerSqlEgressPolicy toPolicy() {
    return new WorkerSqlEgressPolicy(
        connections.stream().map(Connection::toDescriptor).toList(),
        allowedTargets.stream().map(Target::toTarget).toList());
  }

  /**
   * 单个允许访问的 SQL 网络出口目标。
   */
  public static class Target {

    private String host;
    private int port;

    public String getHost() {
      return host;
    }

    public void setHost(String host) {
      this.host = host;
    }

    public int getPort() {
      return port;
    }

    public void setPort(int port) {
      this.port = port;
    }

    WorkerSqlEgressTarget toTarget() {
      return new WorkerSqlEgressTarget(host, port);
    }
  }

  /**
   * 本地 SQL 连接目录项，只保存元数据和凭据别名。
   */
  public static class Connection {

    private String connectionId;
    private String targetEnvironment;
    private String host;
    private int port;
    private String credentialAlias;
    private boolean enabled;

    public String getConnectionId() {
      return connectionId;
    }

    public void setConnectionId(String connectionId) {
      this.connectionId = connectionId;
    }

    public String getTargetEnvironment() {
      return targetEnvironment;
    }

    public void setTargetEnvironment(String targetEnvironment) {
      this.targetEnvironment = targetEnvironment;
    }

    public String getHost() {
      return host;
    }

    public void setHost(String host) {
      this.host = host;
    }

    public int getPort() {
      return port;
    }

    public void setPort(int port) {
      this.port = port;
    }

    public String getCredentialAlias() {
      return credentialAlias;
    }

    public void setCredentialAlias(String credentialAlias) {
      this.credentialAlias = credentialAlias;
    }

    public boolean isEnabled() {
      return enabled;
    }

    public void setEnabled(boolean enabled) {
      this.enabled = enabled;
    }

    WorkerSqlConnectionDescriptor toDescriptor() {
      return new WorkerSqlConnectionDescriptor(
          connectionId,
          targetEnvironment,
          host,
          port,
          credentialAlias,
          enabled);
    }
  }
}
