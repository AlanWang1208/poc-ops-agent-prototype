package com.company.opsagent.executionworker;

/**
 * Worker 监听地址安全保护。
 *
 * <p>P1 允许本地回环开发关闭传输认证；一旦绑定到非回环地址，必须先启用传输认证，避免未认证 Worker 被跨主机直接调用。
 */
public class WorkerBindingSafetyGuard {

  private final String serverAddress;
  private final WorkerTransportAuthProperties transportAuthProperties;

  public WorkerBindingSafetyGuard(String serverAddress, WorkerTransportAuthProperties transportAuthProperties) {
    this.serverAddress = serverAddress == null || serverAddress.isBlank() ? "0.0.0.0" : serverAddress;
    this.transportAuthProperties = transportAuthProperties;
  }

  /**
   * 校验当前绑定地址与传输认证配置是否满足 P1 安全边界。
   */
  public void validate() {
    if (!isLoopback(serverAddress) && !transportAuthProperties.isEnabled()) {
      throw new IllegalStateException("worker transport auth must be enabled when binding to a non-loopback address");
    }
  }

  private boolean isLoopback(String address) {
    String normalized = address.trim().toLowerCase();
    return "localhost".equals(normalized)
        || "127.0.0.1".equals(normalized)
        || "::1".equals(normalized)
        || "0:0:0:0:0:0:0:1".equals(normalized);
  }
}
