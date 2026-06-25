package com.company.opsagent.executionworker.sqlworkbench;

/**
 * Worker 内独立实施的只读 SQL 判定边界。
 */
public interface SqlReadOnlyGuard {

  boolean isReadOnly(String sql);
}
