package com.company.opsagent.executionworker;

import com.company.opsagent.contracts.sqlworkbench.SqlQueryExecutionRequest;
import com.company.opsagent.contracts.sqlworkbench.SqlQueryExecutionResult;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import reactor.core.publisher.Mono;
import reactor.core.scheduler.Schedulers;

/**
 * SQL 查询 Worker 入口；阻塞 JDBC 执行被隔离到 boundedElastic。
 */
@RestController
@RequestMapping("/internal/executions/sql-query")
public class SqlQueryExecutionController {

  private final RestrictedSqlQueryExecutionWorker worker;

  public SqlQueryExecutionController(RestrictedSqlQueryExecutionWorker worker) {
    this.worker = worker;
  }

  @PostMapping
  public Mono<SqlQueryExecutionResult> execute(@RequestBody SqlQueryExecutionRequest request) {
    return Mono.fromCallable(() -> worker.execute(request)).subscribeOn(Schedulers.boundedElastic());
  }
}
