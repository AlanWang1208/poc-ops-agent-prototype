package com.company.opsagent.controlplane.modules.agentruntime;

/**
 * Result of a model provider connectivity test.
 */
public record ModelProviderProbeResult(
    String status,
    String message) {

  public ModelProviderProbeResult {
    status = ModelProviderValues.requiredText(status, "status");
    message = ModelProviderValues.requiredText(message, "message");
  }
}
