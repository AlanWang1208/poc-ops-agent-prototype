package com.company.opsagent.executionworker;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.time.Clock;
import java.util.List;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * Worker 允许列表和执行核心装配。
 */
@Configuration
public class ExecutionWorkerConfiguration {

  /**
   * 提供可替换的系统时钟。
   */
  @Bean
  Clock workerClock() {
    return Clock.systemUTC();
  }

  /**
   * 注册当前 P1 唯一允许执行的节点健康只读适配器。
   */
  @Bean
  NodeHealthReadAdapter nodeHealthReadAdapter(ObjectMapper objectMapper, Clock workerClock) {
    return new NodeHealthReadAdapter(objectMapper, workerClock);
  }

  /**
   * 构建受限 Worker 核心，明确传入允许列表。
   */
  @Bean
  RestrictedReadOnlyExecutionWorker restrictedReadOnlyExecutionWorker(
      NodeHealthReadAdapter nodeHealthReadAdapter,
      Clock workerClock) {
    return new RestrictedReadOnlyExecutionWorker(List.of(nodeHealthReadAdapter), workerClock);
  }

  @Bean
  RestrictedSqlQueryExecutionWorker restrictedSqlQueryExecutionWorker(Clock workerClock) {
    return new RestrictedSqlQueryExecutionWorker(
        new CalciteSqlReadOnlyGuard(),
        request -> {
          throw new IllegalStateException("AS/400 connection and KeyStore are not configured");
        },
        workerClock);
  }
}
