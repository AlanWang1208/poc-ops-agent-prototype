package com.company.opsagent.contracts.sqlworkbench;

import static com.company.opsagent.contracts.ContractValues.requiredList;
import static com.company.opsagent.contracts.ContractValues.requiredText;

import java.util.List;

/**
 * 前端可发现的受控数据库连接摘要，不包含连接串或凭据。
 */
public record SqlConnectionSummary(
    String contractVersion,
    String connectionId,
    String displayName,
    String targetEnvironment,
    String platformType,
    List<String> allowedSchemas,
    List<SqlQueryAction> capabilities) {

  public SqlConnectionSummary {
    if (!"1.0".equals(contractVersion)) {
      throw new IllegalArgumentException("contractVersion must be 1.0");
    }
    connectionId = requiredText(connectionId, "connectionId");
    displayName = requiredText(displayName, "displayName");
    targetEnvironment = requiredText(targetEnvironment, "targetEnvironment");
    if ("production".equalsIgnoreCase(targetEnvironment)) {
      throw new IllegalArgumentException("production connections must not be exposed");
    }
    platformType = requiredText(platformType, "platformType");
    allowedSchemas = requiredList(allowedSchemas, "allowedSchemas");
    capabilities = requiredList(capabilities, "capabilities");
  }
}
