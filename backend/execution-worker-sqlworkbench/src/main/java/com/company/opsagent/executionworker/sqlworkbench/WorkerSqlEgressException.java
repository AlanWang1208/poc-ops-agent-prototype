package com.company.opsagent.executionworker.sqlworkbench;

/**
 * Worker SQL 出口策略拒绝时返回给调用链的稳定错误。
 */
public final class WorkerSqlEgressException extends RuntimeException {

  private final String errorCode;
  private final String safeMessage;

  public WorkerSqlEgressException(String errorCode, String safeMessage) {
    super(requiredText(safeMessage, "safeMessage"));
    this.errorCode = requiredText(errorCode, "errorCode");
    this.safeMessage = safeMessage.trim();
  }

  public String errorCode() {
    return errorCode;
  }

  public String safeMessage() {
    return safeMessage;
  }

  private static String requiredText(String value, String name) {
    if (value == null || value.isBlank()) {
      throw new IllegalArgumentException(name + " is required");
    }
    return value.trim();
  }
}
