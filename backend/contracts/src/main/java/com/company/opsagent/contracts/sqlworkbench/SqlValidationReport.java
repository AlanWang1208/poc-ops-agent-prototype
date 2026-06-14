package com.company.opsagent.contracts.sqlworkbench;

import static com.company.opsagent.contracts.ContractValues.required;
import static com.company.opsagent.contracts.ContractValues.requiredText;

import java.util.List;

/**
 * SQL 静态校验或 DML 预检报告。
 */
public record SqlValidationReport(
    String contractVersion,
    SqlStatementType statementType,
    SqlValidationLevel validationLevel,
    String sqlHash,
    List<String> referencedObjects,
    List<String> risks,
    List<String> rejectionReasons,
    List<String> unverifiedItems) {

  public SqlValidationReport {
    if (!"1.0".equals(contractVersion)) {
      throw new IllegalArgumentException("contractVersion must be 1.0");
    }
    statementType = required(statementType, "statementType");
    validationLevel = required(validationLevel, "validationLevel");
    sqlHash = requiredText(sqlHash, "sqlHash");
    referencedObjects = referencedObjects == null ? List.of() : List.copyOf(referencedObjects);
    risks = risks == null ? List.of() : List.copyOf(risks);
    rejectionReasons = rejectionReasons == null ? List.of() : List.copyOf(rejectionReasons);
    unverifiedItems = unverifiedItems == null ? List.of() : List.copyOf(unverifiedItems);
  }
}
