package com.company.opsagent.controlplane.modules.agentruntime;

/**
 * Verifies that a model provider can be used by the runtime.
 */
@FunctionalInterface
public interface ModelProviderProbe {

  ModelProviderProbeResult test(ModelProvider provider);
}
