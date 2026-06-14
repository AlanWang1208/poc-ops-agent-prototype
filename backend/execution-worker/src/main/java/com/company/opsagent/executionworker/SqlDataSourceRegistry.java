package com.company.opsagent.executionworker;

import javax.sql.DataSource;

/**
 * Worker 内连接标识到受控 JDBC 数据源的解析边界。
 */
@FunctionalInterface
public interface SqlDataSourceRegistry {

  DataSource resolve(String connectionId);
}
