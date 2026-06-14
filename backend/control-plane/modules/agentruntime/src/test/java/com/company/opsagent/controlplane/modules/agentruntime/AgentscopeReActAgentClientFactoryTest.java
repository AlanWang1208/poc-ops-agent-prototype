package com.company.opsagent.controlplane.modules.agentruntime;

import static org.junit.jupiter.api.Assertions.assertInstanceOf;

import java.time.Duration;
import org.junit.jupiter.api.Test;

class AgentscopeReActAgentClientFactoryTest {

  @Test
  void createsOpenAiCompatibleReActClientWithoutExposingAgentscopeModelConstruction() {
    AgentscopeAgentClient client = AgentscopeReActAgentClientFactory.openAiCompatible(
        "test-api-key",
        "test-model",
        "https://model-provider.example/v1",
        3,
        Duration.ofSeconds(5));

    assertInstanceOf(AgentscopeReActAgentClient.class, client);
  }
}
