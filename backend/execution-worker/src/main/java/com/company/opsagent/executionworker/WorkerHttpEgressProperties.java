package com.company.opsagent.executionworker;

import java.util.List;
import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * Worker 本地 HTTP 出口 allowlist 配置。
 */
@ConfigurationProperties(prefix = "ops-agent.worker.http-egress")
public class WorkerHttpEgressProperties {

  private List<Target> allowedTargets = List.of();

  /**
   * Worker 允许访问的 HTTP 主机、端口和协议列表。
   */
  public List<Target> getAllowedTargets() {
    return allowedTargets;
  }

  public void setAllowedTargets(List<Target> allowedTargets) {
    this.allowedTargets = allowedTargets == null ? List.of() : List.copyOf(allowedTargets);
  }

  public WorkerHttpEgressPolicy toPolicy() {
    return new WorkerHttpEgressPolicy(allowedTargets.stream().map(Target::toTarget).toList());
  }

  /**
   * 单个允许访问的 HTTP 网络出口目标。
   */
  public static class Target {

    private String scheme;
    private String host;
    private int port;

    public String getScheme() {
      return scheme;
    }

    public void setScheme(String scheme) {
      this.scheme = scheme;
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

    WorkerHttpEgressTarget toTarget() {
      return new WorkerHttpEgressTarget(scheme, host, port);
    }
  }
}
