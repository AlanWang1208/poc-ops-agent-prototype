package com.company.opsagent.controlplane.modules.agentruntime;

import java.time.Duration;

/**
 * Command used by administrators to create a model provider.
 */
public record ModelProviderCreateCommand(
    String displayName,
    String baseUrl,
    String modelName,
    String apiKey,
    Duration timeout,
    int maxIterations,
    int maxToolCalls,
    Duration maxToolCallDuration) {

  public ModelProviderCreateCommand {
    displayName = ModelProviderValues.requiredText(displayName, "displayName");
    baseUrl = ModelProviderValues.validBaseUrl(baseUrl);
    modelName = ModelProviderValues.requiredText(modelName, "modelName");
    apiKey = ModelProviderValues.requiredText(apiKey, "apiKey");
    timeout = ModelProviderValues.positiveDuration(timeout, "timeout");
    maxIterations = ModelProviderValues.positiveInt(maxIterations, "maxIterations");
    maxToolCalls = ModelProviderValues.positiveInt(maxToolCalls, "maxToolCalls");
    maxToolCallDuration = ModelProviderValues.positiveDuration(
        maxToolCallDuration,
        "maxToolCallDuration");
  }
}
