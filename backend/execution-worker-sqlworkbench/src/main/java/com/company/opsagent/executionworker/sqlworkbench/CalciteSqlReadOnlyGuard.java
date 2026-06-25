package com.company.opsagent.executionworker.sqlworkbench;

import org.apache.calcite.sql.SqlNode;
import org.apache.calcite.sql.SqlNodeList;
import org.apache.calcite.sql.SqlOrderBy;
import org.apache.calcite.sql.SqlSelect;
import org.apache.calcite.sql.SqlWith;
import org.apache.calcite.sql.parser.SqlParseException;
import org.apache.calcite.sql.parser.SqlParser;

/**
 * Worker 使用 Calcite AST 重新验证 SQL 确实是单条只读查询。
 */
public class CalciteSqlReadOnlyGuard implements SqlReadOnlyGuard {

  @Override
  public boolean isReadOnly(String sql) {
    try {
      SqlNodeList statements = SqlParser.create(sql).parseStmtList();
      return statements.size() == 1 && isSelect(statements.getFirst());
    } catch (SqlParseException exception) {
      return false;
    }
  }

  private boolean isSelect(SqlNode statement) {
    if (statement instanceof SqlSelect) {
      return true;
    }
    if (statement instanceof SqlOrderBy orderBy) {
      return isSelect(orderBy.query);
    }
    if (statement instanceof SqlWith with) {
      return isSelect(with.body);
    }
    return false;
  }
}
