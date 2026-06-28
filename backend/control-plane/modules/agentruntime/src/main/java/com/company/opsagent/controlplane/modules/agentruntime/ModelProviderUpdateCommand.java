package com.company.opsagent.controlplane.modules.agentruntime;

import java.time.Duration;

/**
 * Command used to update non-secret model provider metadata.
 */
public record ModelProviderUpdateCommand(
    String displayName,
    String baseUrl,
    String modelName,
    boolean enabled,
    Duration timeout,
    int maxIterations,
    int maxToolCalls,
    Duration maxToolCallDuration) {

  public ModelProviderUpdateCommand {
    displayName = ModelProviderValues.requiredText(displayName, "displayName");
    baseUrl = ModelProviderValues.validBaseUrl(baseUrl);
    modelName = ModelProviderValues.requiredText(modelName, "modelName");
    timeout = ModelProviderValues.positiveDuration(timeout, "timeout");
    maxIterations = ModelProviderValues.positiveInt(maxIterations, "maxIterations");
    maxToolCalls = ModelProviderValues.positiveInt(maxToolCalls, "maxToolCalls");
    maxToolCallDuration = ModelProviderValues.positiveDuration(
        maxToolCallDuration,
        "maxToolCallDuration");
  }
}
