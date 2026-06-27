package com.company.opsagent.executionworker.sqlworkbench;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.time.Clock;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * SQL 工作台 Worker 侧适配模块装配。
 */
@Configuration
@EnableConfigurationProperties(WorkerSqlEgressProperties.class)
public class SqlWorkbenchWorkerConfiguration {

  /**
   * 构建 Worker 本地 SQL 出口策略，默认空配置即拒绝所有 SQL 目标。
   */
  @Bean
  WorkerSqlEgressPolicy workerSqlEgressPolicy(WorkerSqlEgressProperties properties) {
    return properties.toPolicy();
  }

  /**
   * SQL 结果短期存储，P1 仅用于只读诊断结果暂存。
   */
  @Bean
  SqlResultStore sqlResultStore(Clock workerClock) {
    return new InMemorySqlResultStore(workerClock);
  }

  /**
   * SQL 数据源解析边界，真实连接配置接入前仍先强制执行出口 allowlist。
   */
  @Bean
  SqlDataSourceRegistry sqlDataSourceRegistry(WorkerSqlEgressPolicy workerSqlEgressPolicy) {
    return new PolicyEnforcedSqlDataSourceRegistry(
        workerSqlEgressPolicy,
        request -> {
          throw new IllegalStateException("AS/400 connection and KeyStore are not configured");
        });
  }

  /**
   * 构建阻塞 JDBC 只读查询执行器。
   */
  @Bean
  SqlQueryExecutor sqlQueryExecutor(
      SqlDataSourceRegistry sqlDataSourceRegistry,
      SqlResultStore sqlResultStore,
      ObjectMapper objectMapper,
      Clock workerClock) {
    return new JdbcSqlQueryExecutor(sqlDataSourceRegistry, sqlResultStore, objectMapper, workerClock);
  }

  /**
   * 构建 SQL 查询专用受限 Worker。
   */
  @Bean
  RestrictedSqlQueryExecutionWorker restrictedSqlQueryExecutionWorker(
      Clock workerClock,
      SqlQueryExecutor sqlQueryExecutor) {
    return new RestrictedSqlQueryExecutionWorker(
        new CalciteSqlReadOnlyGuard(),
        sqlQueryExecutor,
        workerClock);
  }
}
