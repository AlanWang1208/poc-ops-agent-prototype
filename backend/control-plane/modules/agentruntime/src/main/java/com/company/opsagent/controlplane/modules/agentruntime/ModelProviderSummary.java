package com.company.opsagent.controlplane.modules.agentruntime;

import com.fasterxml.jackson.annotation.JsonIgnore;
import java.time.Duration;
import java.time.OffsetDateTime;
import java.util.Optional;

/**
 * Safe model provider projection for APIs and UI. It never carries secret material.
 */
public record ModelProviderSummary(
    String providerId,
    String displayName,
    ModelProviderType providerType,
    String baseUrl,
    String modelName,
    boolean enabled,
    boolean defaultProvider,
    Duration timeout,
    int maxIterations,
    int maxToolCalls,
    Duration maxToolCallDuration,
    boolean apiKeyConfigured,
    String apiKeyFingerprint,
    OffsetDateTime apiKeyLastRotatedAt,
    long configVersion,
    OffsetDateTime updatedAt) {

  public ModelProviderSummary {
    providerId = ModelProviderValues.requiredText(providerId, "providerId");
    displayName = ModelProviderValues.requiredText(displayName, "displayName");
    providerType = providerType == null ? ModelProviderType.OPENAI_COMPATIBLE : providerType;
    baseUrl = ModelProviderValues.validBaseUrl(baseUrl);
    modelName = ModelProviderValues.requiredText(modelName, "modelName");
    timeout = ModelProviderValues.positiveDuration(timeout, "timeout");
    maxIterations = ModelProviderValues.positiveInt(maxIterations, "maxIterations");
    maxToolCalls = ModelProviderValues.positiveInt(maxToolCalls, "maxToolCalls");
    maxToolCallDuration = ModelProviderValues.positiveDuration(
        maxToolCallDuration,
        "maxToolCallDuration");
    apiKeyFingerprint = ModelProviderValues.requiredText(apiKeyFingerprint, "apiKeyFingerprint");
    apiKeyLastRotatedAt = ModelProviderValues.requiredTime(
        apiKeyLastRotatedAt,
        "apiKeyLastRotatedAt");
    if (configVersion < 1) {
      throw new IllegalArgumentException("configVersion must be positive");
    }
    updatedAt = ModelProviderValues.requiredTime(updatedAt, "updatedAt");
  }

  @JsonIgnore
  public Optional<String> apiKeyCiphertext() {
    return Optional.empty();
  }

  static ModelProviderSummary from(ModelProvider provider) {
    return new ModelProviderSummary(
        provider.providerId(),
        provider.displayName(),
        provider.providerType(),
        provider.baseUrl(),
        provider.modelName(),
        provider.enabled(),
        provider.defaultProvider(),
        provider.timeout(),
        provider.maxIterations(),
        provider.maxToolCalls(),
        provider.maxToolCallDuration(),
        provider.apiKeyConfigured(),
        provider.apiKeyFingerprint(),
        provider.apiKeyLastRotatedAt(),
        provider.configVersion(),
        provider.updatedAt());
  }
}
