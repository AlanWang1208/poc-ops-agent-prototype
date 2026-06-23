package com.company.opsagent.contracts.workflow;

/**
 * 控制面调用独立 Worker 时使用的传输认证请求头名称。
 *
 * <p>这些名称属于控制面与 Worker 的跨交付单元契约，集中放在 contracts 模块中，避免两端各自硬编码后发生漂移。
 */
public final class WorkerTransportHeaders {

  /**
   * 签名密钥标识，用于支持后续密钥轮换。
   */
  public static final String KEY_ID = "X-Ops-Agent-Worker-Key-Id";

  /**
   * 控制面生成签名时的 UTC 时间戳。
   */
  public static final String TIMESTAMP = "X-Ops-Agent-Worker-Timestamp";

  /**
   * 基于版本化 canonical payload 计算出的 HMAC-SHA256 签名。
   */
  public static final String SIGNATURE = "X-Ops-Agent-Worker-Signature";

  private WorkerTransportHeaders() {
  }
}
