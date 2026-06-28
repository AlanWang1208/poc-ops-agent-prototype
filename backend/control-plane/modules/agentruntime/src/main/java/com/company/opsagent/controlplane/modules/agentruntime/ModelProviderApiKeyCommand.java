package com.company.opsagent.controlplane.modules.agentruntime;

/**
 * Command used to rotate a model provider API Key.
 */
public record ModelProviderApiKeyCommand(String apiKey) {

  public ModelProviderApiKeyCommand {
    apiKey = ModelProviderValues.requiredText(apiKey, "apiKey");
  }
}
