package com.company.opsagent.controlplane.bootstrap.api;

import com.company.opsagent.contracts.sqlworkbench.SqlConnectionSummary;
import com.company.opsagent.contracts.sqlworkbench.SqlQueryRequest;
import com.company.opsagent.contracts.sqlworkbench.SqlValidationReport;
import com.company.opsagent.controlplane.modules.sqlworkbench.SqlWorkbenchService;
import java.util.List;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import reactor.core.publisher.Mono;

/**
 * 受服务端身份、策略与审计保护的 SQL 工作台入口。
 */
@RestController
@RequestMapping("/internal/sql-workbench")
public class SqlWorkbenchController {

  private final SqlWorkbenchService sqlWorkbenchService;

  public SqlWorkbenchController(SqlWorkbenchService sqlWorkbenchService) {
    this.sqlWorkbenchService = sqlWorkbenchService;
  }

  @GetMapping("/connections")
  public Mono<List<SqlConnectionSummary>> connections() {
    return Mono.fromSupplier(sqlWorkbenchService::listConnections);
  }

  @PostMapping("/queries/validate")
  public Mono<SqlValidationReport> validate(@RequestBody SqlQueryRequest request) {
    return Mono.fromSupplier(() -> sqlWorkbenchService.validate(request));
  }
}
