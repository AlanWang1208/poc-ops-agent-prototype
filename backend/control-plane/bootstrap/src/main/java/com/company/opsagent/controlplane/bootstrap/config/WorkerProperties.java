package com.company.opsagent.controlplane.bootstrap.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * 控制面连接独立执行 Worker 的配置。
 */
@ConfigurationProperties(prefix = "ops-agent.worker")
public class WorkerProperties {

  private String baseUrl = "http://127.0.0.1:8091";
  private TransportAuth transportAuth = new TransportAuth();

  /**
   * 返回 Worker 基础地址。
   */
  public String getBaseUrl() {
    return baseUrl;
  }

  /**
   * 设置 Worker 基础地址。
   */
  public void setBaseUrl(String baseUrl) {
    this.baseUrl = baseUrl;
  }

  /**
   * 返回控制面调用 Worker 时使用的传输认证配置。
   */
  public TransportAuth getTransportAuth() {
    return transportAuth;
  }

  public void setTransportAuth(TransportAuth transportAuth) {
    this.transportAuth = transportAuth == null ? new TransportAuth() : transportAuth;
  }

  /**
   * 控制面到 Worker 的应用层签名配置。
   */
  public static class TransportAuth {

    private boolean enabled;
    private String keyId;
    private String sharedSecret;

    /**
     * 是否为 Worker 请求注入 HMAC 签名头。
     */
    public boolean isEnabled() {
      return enabled;
    }

    public void setEnabled(boolean enabled) {
      this.enabled = enabled;
    }

    /**
     * 当前使用的 Worker 签名密钥标识。
     */
    public String getKeyId() {
      return keyId;
    }

    public void setKeyId(String keyId) {
      this.keyId = keyId;
    }

    /**
     * 当前使用的 Worker 签名共享密钥，必须由运行环境安全注入。
     */
    public String getSharedSecret() {
      return sharedSecret;
    }

    public void setSharedSecret(String sharedSecret) {
      this.sharedSecret = sharedSecret;
    }
  }
}
