package com.company.opsagent.executionworker.sqlworkbench;

import java.time.Duration;
import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * SQL Worker HTTP 传输认证配置，沿用通用 Worker 的配置前缀。
 */
@ConfigurationProperties(prefix = "ops-agent.worker.transport-auth")
public class SqlWorkerTransportAuthProperties {

  private boolean enabled;
  private String keyId;
  private String sharedSecret;
  private Duration maxClockSkew = Duration.ofSeconds(30);

  public boolean isEnabled() {
    return enabled;
  }

  public void setEnabled(boolean enabled) {
    this.enabled = enabled;
  }

  public String getKeyId() {
    return keyId;
  }

  public void setKeyId(String keyId) {
    this.keyId = keyId;
  }

  public String getSharedSecret() {
    return sharedSecret;
  }

  public void setSharedSecret(String sharedSecret) {
    this.sharedSecret = sharedSecret;
  }

  public Duration getMaxClockSkew() {
    return maxClockSkew;
  }

  public void setMaxClockSkew(Duration maxClockSkew) {
    this.maxClockSkew = maxClockSkew == null ? Duration.ofSeconds(30) : maxClockSkew;
  }
}
