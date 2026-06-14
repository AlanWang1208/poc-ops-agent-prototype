package com.company.opsagent.contracts.sqlworkbench;

import static com.company.opsagent.contracts.ContractValues.requiredText;

import com.fasterxml.jackson.databind.JsonNode;
import java.time.OffsetDateTime;
import java.util.List;

/**
 * 短期留存的强类型查询结果分页。
 */
public record SqlResultPage(
    String contractVersion,
    String resultId,
    List<SqlResultColumn> columns,
    List<List<JsonNode>> rows,
    String nextCursor,
    boolean truncated,
    OffsetDateTime expiresAt) {

  public SqlResultPage {
    if (!"1.0".equals(contractVersion)) {
      throw new IllegalArgumentException("contractVersion must be 1.0");
    }
    resultId = requiredText(resultId, "resultId");
    columns = List.copyOf(columns);
    rows = rows.stream().map(List::copyOf).toList();
    if (expiresAt == null) {
      throw new IllegalArgumentException("expiresAt must not be null");
    }
  }
}
