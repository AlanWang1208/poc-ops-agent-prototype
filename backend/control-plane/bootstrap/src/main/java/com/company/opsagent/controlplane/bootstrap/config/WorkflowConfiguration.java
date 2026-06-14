package com.company.opsagent.controlplane.bootstrap.config;

import com.company.opsagent.controlplane.bootstrap.service.WebClientWorkerGateway;
import com.company.opsagent.controlplane.modules.agentrouting.SkillRoutingService;
import com.company.opsagent.controlplane.modules.workflow.AgentDiagnosticWorkflowService;
import com.company.opsagent.controlplane.modules.workflow.AgentWorkflowStore;
import com.company.opsagent.controlplane.modules.workflow.ReadOnlyDiagnosticWorkflowService;
import com.company.opsagent.controlplane.modules.workflow.ReadOnlyWorkflowRecoveryService;
import com.company.opsagent.controlplane.modules.workflow.ReadOnlyWorkflowStore;
import com.company.opsagent.controlplane.modules.workflow.R2dbcAgentWorkflowStore;
import com.company.opsagent.controlplane.modules.workflow.R2dbcReadOnlyWorkflowStore;
import com.company.opsagent.controlplane.modules.workflow.RetryableFailureClassifier;
import com.company.opsagent.controlplane.modules.workflow.WorkerGateway;
import com.company.opsagent.controlplane.modules.agentruntime.AgentRuntimeService;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.time.Clock;
import org.springframework.boot.ApplicationRunner;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.core.io.ClassPathResource;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.r2dbc.connection.init.ConnectionFactoryInitializer;
import org.springframework.r2dbc.connection.init.ResourceDatabasePopulator;
import org.springframework.r2dbc.core.DatabaseClient;
import org.springframework.web.reactive.function.client.WebClient;
import io.r2dbc.spi.ConnectionFactory;

/**
 * 只读诊断工作流和独立 Worker 客户端装配。
 */
@Configuration
@EnableConfigurationProperties({WorkerProperties.class, WorkflowPersistenceProperties.class})
public class WorkflowConfiguration {

  /**
   * 构建指向独立 Worker 的非阻塞网关。
   */
  @Bean
  WorkerGateway workerGateway(WebClient.Builder webClientBuilder, WorkerProperties properties) {
    return new WebClientWorkerGateway(webClientBuilder.baseUrl(properties.getBaseUrl()).build());
  }

  @Bean
  ReadOnlyWorkflowStore readOnlyWorkflowStore(DatabaseClient databaseClient, ObjectMapper objectMapper) {
    return new R2dbcReadOnlyWorkflowStore(databaseClient, objectMapper);
  }

  @Bean
  AgentWorkflowStore agentWorkflowStore(DatabaseClient databaseClient) {
    return new R2dbcAgentWorkflowStore(databaseClient);
  }

  @Bean
  ConnectionFactoryInitializer workflowSchemaInitializer(ConnectionFactory connectionFactory) {
    var initializer = new ConnectionFactoryInitializer();
    initializer.setConnectionFactory(connectionFactory);
    initializer.setDatabasePopulator(new ResourceDatabasePopulator(
        new ClassPathResource("sql/migrations/V001__workflow_schema.sql"),
        new ClassPathResource("sql/migrations/V002__agent_workflow_schema.sql")));
    return initializer;
  }

  @Bean
  RetryableFailureClassifier retryableFailureClassifier() {
    return new RetryableFailureClassifier();
  }

  @Bean
  ReadOnlyWorkflowRecoveryService readOnlyWorkflowRecoveryService(
      ReadOnlyWorkflowStore workflowStore,
      WorkerGateway workerGateway,
      RetryableFailureClassifier retryableFailureClassifier) {
    return new ReadOnlyWorkflowRecoveryService(
        workflowStore,
        workerGateway,
        Clock.systemUTC(),
        retryableFailureClassifier);
  }

  @Bean
  ApplicationRunner workflowRecoveryRunner(
      WorkflowPersistenceProperties properties,
      ReadOnlyWorkflowRecoveryService recoveryService) {
    return args -> {
      if (properties.isStartupRecoveryEnabled()) {
        recoveryService.recoverStaleWorkflows().block();
      }
    };
  }

  /**
   * 构建 P1 只读诊断工作流服务。
   */
  @Bean
  ReadOnlyDiagnosticWorkflowService readOnlyDiagnosticWorkflowService(
      SkillRoutingService skillRoutingService,
      WorkerGateway workerGateway,
      ReadOnlyWorkflowStore workflowStore,
      RetryableFailureClassifier retryableFailureClassifier) {
    return new ReadOnlyDiagnosticWorkflowService(
        skillRoutingService,
        workerGateway,
        Clock.systemUTC(),
        workflowStore,
        retryableFailureClassifier);
  }

  @Bean
  AgentDiagnosticWorkflowService agentDiagnosticWorkflowService(
      AgentRuntimeService agentRuntimeService,
      AgentWorkflowStore agentWorkflowStore) {
    return new AgentDiagnosticWorkflowService(
        agentRuntimeService,
        agentWorkflowStore,
        Clock.systemUTC());
  }
}
