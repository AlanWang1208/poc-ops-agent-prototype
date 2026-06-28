package com.company.opsagent.controlplane.bootstrap.config;

import com.company.opsagent.controlplane.bootstrap.service.WebClientSqlWorkbenchWorkerClient;
import com.company.opsagent.controlplane.bootstrap.service.ModelProviderSqlAssistantClient;
import com.company.opsagent.controlplane.modules.agentruntime.ModelProviderSecretCodec;
import com.company.opsagent.controlplane.modules.agentruntime.ModelProviderStore;
import com.company.opsagent.controlplane.modules.sqlworkbench.CalciteSqlValidationService;
import com.company.opsagent.controlplane.modules.sqlworkbench.DefaultSqlWorkbenchService;
import com.company.opsagent.controlplane.modules.sqlworkbench.InMemorySqlConnectionCatalog;
import com.company.opsagent.controlplane.modules.sqlworkbench.SqlAssistantClient;
import com.company.opsagent.controlplane.modules.sqlworkbench.SqlConnectionCatalog;
import com.company.opsagent.controlplane.modules.sqlworkbench.SqlValidationService;
import com.company.opsagent.controlplane.modules.sqlworkbench.SqlWorkbenchWorkerClient;
import com.company.opsagent.controlplane.modules.sqlworkbench.SqlWorkbenchService;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.net.http.HttpClient;
import java.time.Clock;
import java.time.Duration;
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
    return new InMemorySqlConnectionCatalog(List.of());
  }

  @Bean
  SqlValidationService sqlValidationService() {
    return new CalciteSqlValidationService();
  }

  @Bean
  SqlWorkbenchService sqlWorkbenchService(
      SqlConnectionCatalog sqlConnectionCatalog,
      SqlValidationService sqlValidationService,
      SqlWorkbenchWorkerClient sqlWorkbenchWorkerClient,
      SqlAssistantClient sqlAssistantClient) {
    return new DefaultSqlWorkbenchService(
        sqlConnectionCatalog,
        sqlValidationService,
        sqlWorkbenchWorkerClient,
        sqlAssistantClient,
        Clock.systemUTC());
  }

  @Bean
  SqlAssistantClient sqlAssistantClient(
      ModelProviderStore modelProviderStore,
      ModelProviderSecretCodec modelProviderSecretCodec,
      ObjectMapper objectMapper) {
    HttpClient httpClient = HttpClient.newBuilder()
        .connectTimeout(Duration.ofSeconds(5))
        .build();
    return new ModelProviderSqlAssistantClient(
        modelProviderStore,
        modelProviderSecretCodec,
        httpClient,
        objectMapper);
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

}
