package com.company.opsagent.controlplane.modules.agentruntime;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

/**
 * In-memory model provider store for tests and local fallback wiring.
 */
public class InMemoryModelProviderStore implements ModelProviderStore {

  private final Map<String, ModelProvider> providers = new LinkedHashMap<>();

  @Override
  public synchronized List<ModelProvider> list() {
    return List.copyOf(providers.values());
  }

  @Override
  public synchronized Optional<ModelProvider> findById(String providerId) {
    return Optional.ofNullable(providers.get(providerId));
  }

  @Override
  public synchronized Optional<ModelProvider> findDefault() {
    return providers.values().stream()
        .filter(ModelProvider::defaultProvider)
        .findFirst();
  }

  @Override
  public synchronized ModelProvider save(ModelProvider provider) {
    providers.put(provider.providerId(), provider);
    return provider;
  }

  @Override
  public synchronized ModelProvider setDefault(String providerId) {
    ModelProvider target = findById(providerId)
        .orElseThrow(() -> new IllegalArgumentException("model provider not found"));
    providers.replaceAll((id, provider) -> copyWithDefault(provider, id.equals(providerId)));
    return providers.get(target.providerId());
  }

  private ModelProvider copyWithDefault(ModelProvider provider, boolean defaultProvider) {
    return new ModelProvider(
        provider.providerId(),
        provider.displayName(),
        provider.providerType(),
        provider.baseUrl(),
        provider.modelName(),
        provider.enabled(),
        defaultProvider,
        provider.timeout(),
        provider.maxIterations(),
        provider.maxToolCalls(),
        provider.maxToolCallDuration(),
        provider.apiKeyCiphertext(),
        provider.apiKeyNonce(),
        provider.apiKeyAlgorithm(),
        provider.apiKeyFingerprint(),
        provider.apiKeyLastRotatedAt(),
        provider.configVersion(),
        provider.createdBy(),
        provider.createdAt(),
        provider.updatedBy(),
        provider.updatedAt());
  }
}
