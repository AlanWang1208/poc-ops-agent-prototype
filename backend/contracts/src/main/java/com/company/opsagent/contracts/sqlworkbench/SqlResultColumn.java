package com.company.opsagent.contracts.sqlworkbench;

import static com.company.opsagent.contracts.ContractValues.requiredText;

/**
 * 查询结果列定义。
 */
public record SqlResultColumn(String name, String type, boolean masked) {

  public SqlResultColumn {
    name = requiredText(name, "name");
    type = requiredText(type, "type");
  }
}
