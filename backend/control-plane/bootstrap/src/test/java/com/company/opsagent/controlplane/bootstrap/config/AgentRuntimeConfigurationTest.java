package com.company.opsagent.controlplane.bootstrap.config;

import static org.junit.jupiter.api.Assertions.assertInstanceOf;

import com.company.opsagent.controlplane.modules.agentruntime.AgentscopeAgentClient;
import com.company.opsagent.controlplane.modules.agentruntime.LocalWeatherSmokeAgentClient;
import org.junit.jupiter.api.Test;

class AgentRuntimeConfigurationTest {

  @Test
  void createsLocalWeatherSmokeClientOnlyWhenExplicitlyConfigured() {
    AgentRuntimeProperties properties = new AgentRuntimeProperties();
    properties.setProvider("local-weather-smoke");

    AgentscopeAgentClient client = new AgentRuntimeConfiguration().agentscopeAgentClient(properties);

    assertInstanceOf(LocalWeatherSmokeAgentClient.class, client);
  }
}
