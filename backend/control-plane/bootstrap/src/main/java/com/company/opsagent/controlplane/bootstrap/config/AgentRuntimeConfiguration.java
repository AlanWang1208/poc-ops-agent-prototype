package com.company.opsagent.controlplane.bootstrap.config;

import com.company.opsagent.controlplane.modules.agentruntime.AgentRuntimeService;
import com.company.opsagent.controlplane.modules.agentruntime.AgentToolCatalogProvider;
import com.company.opsagent.controlplane.modules.agentruntime.AgentToolDescriptor;
import com.company.opsagent.controlplane.modules.agentruntime.AgentscopeAgentClient;
import com.company.opsagent.controlplane.modules.agentruntime.AgentscopeAgentResponse;
import com.company.opsagent.controlplane.modules.agentruntime.AgentscopePrimaryAgentRuntimeService;
import com.company.opsagent.controlplane.modules.agentruntime.AgentscopeReActAgentClientFactory;
import com.company.opsagent.controlplane.modules.skillregistry.RegisteredSkill;
import com.company.opsagent.controlplane.modules.skillregistry.SkillPublicationStatus;
import com.company.opsagent.controlplane.modules.skillregistry.SkillRegistryService;
import java.util.List;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import reactor.core.publisher.Mono;

/**
 * AgentScope primary runtime wiring for P1 read-only diagnostics.
 */
@Configuration
@EnableConfigurationProperties(AgentRuntimeProperties.class)
public class AgentRuntimeConfiguration {

  @Bean
  AgentToolCatalogProvider agentToolCatalogProvider(SkillRegistryService skillRegistryService) {
    return () -> skillRegistryService.listSkills().stream()
        .filter(skill -> skill.publicationStatus() == SkillPublicationStatus.VALIDATED)
        .filter(skill -> skill.descriptor().readOnly())
        .map(this::toToolDescriptor)
        .toList();
  }

  @Bean
  AgentscopeAgentClient agentscopeAgentClient(AgentRuntimeProperties properties) {
    String apiKey = resolvedApiKey(properties);
    if (isBlank(properties.getModelName()) || isBlank(apiKey)) {
      return notConfiguredClient();
    }
    return AgentscopeReActAgentClientFactory.openAiCompatible(
        apiKey,
        properties.getModelName(),
        properties.getBaseUrl(),
        properties.getMaxIterations(),
        properties.getTimeout());
  }

  private AgentscopeAgentClient notConfiguredClient() {
    return invocation -> Mono.just(new AgentscopeAgentResponse(
        "AGENT_RUNTIME_NOT_CONFIGURED",
        "AgentScope model provider is not configured for this environment.",
        0));
  }

  @Bean
  AgentRuntimeService agentRuntimeService(
      AgentToolCatalogProvider agentToolCatalogProvider,
      AgentscopeAgentClient agentscopeAgentClient) {
    return new AgentscopePrimaryAgentRuntimeService(agentToolCatalogProvider, agentscopeAgentClient);
  }

  private AgentToolDescriptor toToolDescriptor(RegisteredSkill skill) {
    List<String> parameterNames = skill.descriptor().parameters().stream()
        .map(parameter -> parameter.name())
        .toList();
    return new AgentToolDescriptor(
        skill.descriptor().skillId(),
        skill.descriptor().version(),
        skill.descriptor().description(),
        skill.descriptor().skillId() + ":" + skill.descriptor().version() + ":input",
        skill.descriptor().skillId() + ":" + skill.descriptor().version() + ":output",
        parameterNames,
        skill.descriptor().riskLevel().name());
  }

  private String resolvedApiKey(AgentRuntimeProperties properties) {
    if (!isBlank(properties.getApiKey())) {
      return properties.getApiKey();
    }
    if (isBlank(properties.getApiKeyEnv())) {
      return "";
    }
    return System.getenv(properties.getApiKeyEnv());
  }

  private boolean isBlank(String value) {
    return value == null || value.isBlank();
  }
}
