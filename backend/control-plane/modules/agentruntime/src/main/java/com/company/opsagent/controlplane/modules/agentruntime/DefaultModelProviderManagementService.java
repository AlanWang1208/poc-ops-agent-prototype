package com.company.opsagent.controlplane.modules.agentruntime;

import java.time.Clock;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

/**
 * Default model provider management use cases.
 */
public class DefaultModelProviderManagementService {

  private final ModelProviderStore store;
  private final ModelProviderSecretCodec secretCodec;
  private final ModelProviderProbe probe;
  private final Clock clock;

  public DefaultModelProviderManagementService(
      ModelProviderStore store,
      ModelProviderSecretCodec secretCodec,
      ModelProviderProbe probe,
      Clock clock) {
    this.store = store;
    this.secretCodec = secretCodec;
    this.probe = probe;
    this.clock = clock;
  }

  public List<ModelProviderSummary> list() {
    return store.list().stream()
        .map(ModelProviderSummary::from)
        .toList();
  }

  public Optional<ModelProviderSummary> get(String providerId) {
    return store.findById(providerId)
        .map(ModelProviderSummary::from);
  }

  public Optional<ModelProviderSummary> defaultProvider() {
    return store.findDefault()
        .map(ModelProviderSummary::from);
  }

  public ModelProviderSummary create(ModelProviderCreateCommand command, String operatorId) {
    OffsetDateTime now = OffsetDateTime.now(clock);
    ModelProviderSecretCodec.EncryptedSecret encrypted = secretCodec.encrypt(command.apiKey());
    ModelProvider provider = new ModelProvider(
        UUID.randomUUID().toString(),
        command.displayName(),
        ModelProviderType.OPENAI_COMPATIBLE,
        command.baseUrl(),
        command.modelName(),
        true,
        false,
        command.timeout(),
        command.maxIterations(),
        command.maxToolCalls(),
        command.maxToolCallDuration(),
        encrypted.ciphertext(),
        encrypted.nonce(),
        encrypted.algorithm(),
        encrypted.fingerprint(),
        now,
        1,
        operatorId,
        now,
        operatorId,
        now);
    return ModelProviderSummary.from(store.save(provider));
  }

  public ModelProviderSummary update(
      String providerId,
      ModelProviderUpdateCommand command,
      String operatorId) {
    ModelProvider existing = existing(providerId);
    OffsetDateTime now = OffsetDateTime.now(clock);
    ModelProvider updated = new ModelProvider(
        existing.providerId(),
        command.displayName(),
        existing.providerType(),
        command.baseUrl(),
        command.modelName(),
        command.enabled(),
        existing.defaultProvider() && command.enabled(),
        command.timeout(),
        command.maxIterations(),
        command.maxToolCalls(),
        command.maxToolCallDuration(),
        existing.apiKeyCiphertext(),
        existing.apiKeyNonce(),
        existing.apiKeyAlgorithm(),
        existing.apiKeyFingerprint(),
        existing.apiKeyLastRotatedAt(),
        existing.configVersion() + 1,
        existing.createdBy(),
        existing.createdAt(),
        operatorId,
        now);
    return ModelProviderSummary.from(store.save(updated));
  }

  public ModelProviderSummary rotateApiKey(
      String providerId,
      ModelProviderApiKeyCommand command,
      String operatorId) {
    ModelProvider existing = existing(providerId);
    OffsetDateTime now = OffsetDateTime.now(clock);
    ModelProviderSecretCodec.EncryptedSecret encrypted = secretCodec.encrypt(command.apiKey());
    ModelProvider updated = new ModelProvider(
        existing.providerId(),
        existing.displayName(),
        existing.providerType(),
        existing.baseUrl(),
        existing.modelName(),
        existing.enabled(),
        existing.defaultProvider(),
        existing.timeout(),
        existing.maxIterations(),
        existing.maxToolCalls(),
        existing.maxToolCallDuration(),
        encrypted.ciphertext(),
        encrypted.nonce(),
        encrypted.algorithm(),
        encrypted.fingerprint(),
        now,
        existing.configVersion() + 1,
        existing.createdBy(),
        existing.createdAt(),
        operatorId,
        now);
    return ModelProviderSummary.from(store.save(updated));
  }

  public ModelProviderProbeResult test(String providerId) {
    return probe.test(existing(providerId));
  }

  public ModelProviderSummary setDefault(String providerId, String operatorId) {
    ModelProvider provider = existing(providerId);
    if (!provider.enabled()) {
      throw new IllegalStateException("disabled model provider cannot be default");
    }
    return ModelProviderSummary.from(store.setDefault(providerId));
  }

  public ModelProviderSummary disable(String providerId, String operatorId) {
    ModelProvider existing = existing(providerId);
    OffsetDateTime now = OffsetDateTime.now(clock);
    ModelProvider disabled = new ModelProvider(
        existing.providerId(),
        existing.displayName(),
        existing.providerType(),
        existing.baseUrl(),
        existing.modelName(),
        false,
        false,
        existing.timeout(),
        existing.maxIterations(),
        existing.maxToolCalls(),
        existing.maxToolCallDuration(),
        existing.apiKeyCiphertext(),
        existing.apiKeyNonce(),
        existing.apiKeyAlgorithm(),
        existing.apiKeyFingerprint(),
        existing.apiKeyLastRotatedAt(),
        existing.configVersion() + 1,
        existing.createdBy(),
        existing.createdAt(),
        operatorId,
        now);
    return ModelProviderSummary.from(store.save(disabled));
  }

  private ModelProvider existing(String providerId) {
    return store.findById(providerId)
        .orElseThrow(() -> new IllegalArgumentException("model provider not found"));
  }
}
