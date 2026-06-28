package com.company.opsagent.controlplane.modules.agentruntime;

import java.time.Duration;
import java.time.OffsetDateTime;

/**
 * Persisted model provider configuration. API Key plaintext is never stored here.
 */
public record ModelProvider(
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
    String apiKeyCiphertext,
    String apiKeyNonce,
    String apiKeyAlgorithm,
    String apiKeyFingerprint,
    OffsetDateTime apiKeyLastRotatedAt,
    long configVersion,
    String createdBy,
    OffsetDateTime createdAt,
    String updatedBy,
    OffsetDateTime updatedAt) {

  public ModelProvider {
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
    apiKeyCiphertext = ModelProviderValues.requiredText(apiKeyCiphertext, "apiKeyCiphertext");
    apiKeyNonce = ModelProviderValues.requiredText(apiKeyNonce, "apiKeyNonce");
    apiKeyAlgorithm = ModelProviderValues.requiredText(apiKeyAlgorithm, "apiKeyAlgorithm");
    apiKeyFingerprint = ModelProviderValues.requiredText(apiKeyFingerprint, "apiKeyFingerprint");
    apiKeyLastRotatedAt = ModelProviderValues.requiredTime(
        apiKeyLastRotatedAt,
        "apiKeyLastRotatedAt");
    if (configVersion < 1) {
      throw new IllegalArgumentException("configVersion must be positive");
    }
    createdBy = ModelProviderValues.requiredText(createdBy, "createdBy");
    createdAt = ModelProviderValues.requiredTime(createdAt, "createdAt");
    updatedBy = ModelProviderValues.requiredText(updatedBy, "updatedBy");
    updatedAt = ModelProviderValues.requiredTime(updatedAt, "updatedAt");
  }

  public boolean apiKeyConfigured() {
    return true;
  }
}
