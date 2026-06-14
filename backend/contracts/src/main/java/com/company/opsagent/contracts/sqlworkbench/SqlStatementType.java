package com.company.opsagent.contracts.sqlworkbench;

/**
 * SQL 工作台识别的保守语句分类。
 */
public enum SqlStatementType {
  SELECT,
  INSERT,
  UPDATE,
  DELETE,
  UNSUPPORTED
}
