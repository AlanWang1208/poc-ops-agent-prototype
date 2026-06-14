package com.company.opsagent.contracts.sqlworkbench;

/**
 * 服务端可进一步收紧的查询资源限制。
 */
public record SqlQueryLimits(int maxRows, long maxBytes, int timeoutSeconds) {

  public SqlQueryLimits {
    if (maxRows < 1 || maxRows > 10_000) {
      throw new IllegalArgumentException("maxRows must be between 1 and 10000");
    }
    if (maxBytes < 1 || maxBytes > 100_000_000) {
      throw new IllegalArgumentException("maxBytes must be between 1 and 100000000");
    }
    if (timeoutSeconds < 1 || timeoutSeconds > 300) {
      throw new IllegalArgumentException("timeoutSeconds must be between 1 and 300");
    }
  }
}
