package com.company.opsagent.controlplane.bootstrap.config;

import com.company.opsagent.contracts.sqlworkbench.SqlConnectionSummary;
import com.company.opsagent.contracts.sqlworkbench.SqlQueryAction;
import com.company.opsagent.controlplane.bootstrap.service.WebClientSqlWorkbenchWorkerClient;
import com.company.opsagent.controlplane.modules.sqlworkbench.CalciteSqlValidationService;
import com.company.opsagent.controlplane.modules.sqlworkbench.DefaultSqlWorkbenchService;
import com.company.opsagent.controlplane.modules.sqlworkbench.InMemorySqlConnectionCatalog;
import com.company.opsagent.controlplane.modules.sqlworkbench.SqlConnectionCatalog;
import com.company.opsagent.controlplane.modules.sqlworkbench.SqlValidationService;
import com.company.opsagent.controlplane.modules.sqlworkbench.SqlWorkbenchWorkerClient;
import com.company.opsagent.controlplane.modules.sqlworkbench.SqlWorkbenchService;
import java.time.Clock;
import java.util.List;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.reactive.function.client.WebClient;

/**
 * SQL 工作台 P1 连接目录与校验服务装配。
 */
@Configuration
public class SqlWorkbenchConfiguration {

  @Bean
  SqlConnectionCatalog sqlConnectionCatalog() {
    return new InMemorySqlConnectionCatalog(List.of(
        connection("as400-development", "AS/400 Development", "development", List.of("ORDERS", "INVENTORY")),
        connection("as400-test", "AS/400 Test", "test", List.of("ORDERS", "INVENTORY"))));
  }

  @Bean
  SqlValidationService sqlValidationService() {
    return new CalciteSqlValidationService();
  }

  @Bean
  SqlWorkbenchService sqlWorkbenchService(
      SqlConnectionCatalog sqlConnectionCatalog,
      SqlValidationService sqlValidationService,
      SqlWorkbenchWorkerClient sqlWorkbenchWorkerClient) {
    return new DefaultSqlWorkbenchService(
        sqlConnectionCatalog,
        sqlValidationService,
        sqlWorkbenchWorkerClient,
        Clock.systemUTC());
  }

  @Bean
  SqlWorkbenchWorkerClient sqlWorkbenchWorkerClient(
      WebClient.Builder webClientBuilder,
      WorkerProperties workerProperties) {
    return new WebClientSqlWorkbenchWorkerClient(
        webClientBuilder.baseUrl(workerProperties.getBaseUrl()).build(),
        workerProperties,
        Clock.systemUTC());
  }

  private SqlConnectionSummary connection(
      String id,
      String displayName,
      String environment,
      List<String> schemas) {
    return new SqlConnectionSummary(
        "1.0",
        id,
        displayName,
        environment,
        "DB2_FOR_I",
        schemas,
        List.of(
            SqlQueryAction.VALIDATE,
            SqlQueryAction.EXPLAIN,
            SqlQueryAction.RUN_READ_ONLY,
            SqlQueryAction.PREFLIGHT_DML));
  }
}
