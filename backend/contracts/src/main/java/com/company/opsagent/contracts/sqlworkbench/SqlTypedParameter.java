package com.company.opsagent.contracts.sqlworkbench;

import static com.company.opsagent.contracts.ContractValues.required;
import static com.company.opsagent.contracts.ContractValues.requiredText;

import com.fasterxml.jackson.databind.JsonNode;

/**
 * SQL 命名参数及其显式类型。
 */
public record SqlTypedParameter(String name, String type, JsonNode value) {

  public SqlTypedParameter {
    name = requiredText(name, "name");
    type = requiredText(type, "type");
    value = required(value, "value");
  }
}
