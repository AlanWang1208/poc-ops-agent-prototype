package com.company.opsagent.controlplane.bootstrap.config;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertInstanceOf;

import com.company.opsagent.controlplane.modules.agentruntime.AgentRuntimeRequest;
import com.company.opsagent.controlplane.modules.agentruntime.AgentscopeAgentClient;
import com.company.opsagent.controlplane.modules.agentruntime.AgentscopeAgentInvocation;
import com.company.opsagent.controlplane.modules.agentruntime.AgentscopeAgentResponse;
import com.company.opsagent.controlplane.modules.agentruntime.AgentscopeReActAgentClient;
import com.company.opsagent.controlplane.modules.agentruntime.LocalWeatherSmokeAgentClient;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import reactor.core.publisher.Mono;

class AgentRuntimeConfigurationTest {

  @Test
  void createsLocalWeatherSmokeClientOnlyWhenExplicitlyConfigured() {
    AgentRuntimeProperties properties = new AgentRuntimeProperties();
    properties.setProvider("local-weather-smoke");

    AgentscopeAgentClient client = new AgentRuntimeConfiguration().agentscopeAgentClient(properties);

    assertInstanceOf(LocalWeatherSmokeAgentClient.class, client);
  }

  @Test
  void failsClosedWhenOnlyLocalFakeApiKeyIsConfigured() {
    AgentRuntimeProperties properties = new AgentRuntimeProperties();
    properties.setModelName("gpt-4.1-mini");
    properties.setBaseUrl("https://api.openai.com/v1");
    properties.setApiKey("OPS_AGENT_FAKE_API_KEY_REPLACE_ME");

    AgentscopeAgentClient client = new AgentRuntimeConfiguration().agentscopeAgentClient(properties);

    AgentscopeAgentResponse response = client.run(invocation()).block();
    assertEquals("AGENT_RUNTIME_FAKE_API_KEY", response.status());
  }

  @Test
  void createsOpenAiCompatibleClientWhenRealApiKeyIsConfigured() {
    AgentRuntimeProperties properties = new AgentRuntimeProperties();
    properties.setModelName("gpt-4.1-mini");
    properties.setBaseUrl("https://api.openai.com/v1");
    properties.setApiKey("real-runtime-key-from-secret-store");

    AgentscopeAgentClient client = new AgentRuntimeConfiguration().agentscopeAgentClient(properties);

    assertInstanceOf(AgentscopeReActAgentClient.class, client);
  }

  private AgentscopeAgentInvocation invocation() {
    return new AgentscopeAgentInvocation(
        new AgentRuntimeRequest(
            "task-1",
            "workflow-1",
            "workspace-default",
            "operator-1",
            List.of("ROLE_ops-reader"),
            "dev",
            "Check node health",
            Map.of(),
            "trace-1",
            "request-1"),
        List.of(),
        (runtimeRequest, toolCall) -> Mono.empty());
  }
}
