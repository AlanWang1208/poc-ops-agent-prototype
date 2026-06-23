package com.company.opsagent.executionworker;

import java.time.Duration;
import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * Worker HTTP 传输认证配置。
 *
 * <p>P1 默认允许本地回环开发关闭认证；跨主机或非回环绑定必须启用该配置，并由部署系统注入 Key ID 和共享密钥。
 */
@ConfigurationProperties(prefix = "ops-agent.worker.transport-auth")
public class WorkerTransportAuthProperties {

  private boolean enabled;
  private String keyId;
  private String sharedSecret;
  private Duration maxClockSkew = Duration.ofSeconds(30);

  /**
   * 是否启用控制面到 Worker 的应用层签名认证。
   */
  public boolean isEnabled() {
    return enabled;
  }

  public void setEnabled(boolean enabled) {
    this.enabled = enabled;
  }

  /**
   * 当前接受的签名密钥标识。
   */
  public String getKeyId() {
    return keyId;
  }

  public void setKeyId(String keyId) {
    this.keyId = keyId;
  }

  /**
   * 用于 HMAC-SHA256 校验的共享密钥，必须由运行环境安全注入。
   */
  public String getSharedSecret() {
    return sharedSecret;
  }

  public void setSharedSecret(String sharedSecret) {
    this.sharedSecret = sharedSecret;
  }

  /**
   * Worker 接受的控制面签名时间戳最大漂移。
   */
  public Duration getMaxClockSkew() {
    return maxClockSkew;
  }

  public void setMaxClockSkew(Duration maxClockSkew) {
    this.maxClockSkew = maxClockSkew == null ? Duration.ofSeconds(30) : maxClockSkew;
  }
}
