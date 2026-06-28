package com.company.opsagent.contracts.sqlworkbench;

import static com.company.opsagent.contracts.ContractValues.requiredText;

import java.util.Set;

/**
 * SQL 工作台 P1 允许暴露的开发/测试数据库平台类型。
 */
final class SqlPlatformTypes {

  private static final Set<String> SUPPORTED_TYPES = Set.of("DB2_FOR_I", "H2", "MYSQL");

  private SqlPlatformTypes() {
  }

  static String normalize(String platformType) {
    String normalized = requiredText(platformType, "platformType").toUpperCase();
    if (!SUPPORTED_TYPES.contains(normalized)) {
      throw new IllegalArgumentException("platformType must be one of DB2_FOR_I, H2, MYSQL");
    }
    return normalized;
  }
}
