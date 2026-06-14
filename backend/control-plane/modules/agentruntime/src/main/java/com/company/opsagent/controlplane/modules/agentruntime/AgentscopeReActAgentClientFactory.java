package com.company.opsagent.controlplane.modules.agentruntime;

import io.agentscope.core.model.OpenAIChatModel;
import java.time.Duration;

/**
 * Factory that keeps AgentScope SDK construction details inside the M04 runtime module.
 */
public final class AgentscopeReActAgentClientFactory {

  private AgentscopeReActAgentClientFactory() {
  }

  public static AgentscopeAgentClient openAiCompatible(
      String apiKey,
      String modelName,
      String baseUrl,
      int maxIters,
      Duration timeout) {
    var builder = OpenAIChatModel.builder()
        .apiKey(apiKey)
        .modelName(modelName)
        .stream(false);
    if (baseUrl != null && !baseUrl.isBlank()) {
      builder.baseUrl(baseUrl);
    }
    return new AgentscopeReActAgentClient(builder.build(), maxIters, timeout);
  }
}
