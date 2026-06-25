package com.company.opsagent.executionworker.sqlworkbench;

import com.company.opsagent.contracts.sqlworkbench.SqlResultPage;
import java.util.Optional;

/**
 * SQL 查询结果的短期受控存储。
 */
public interface SqlResultStore {

  void save(SqlResultPage page);

  Optional<SqlResultPage> find(String resultId);
}
