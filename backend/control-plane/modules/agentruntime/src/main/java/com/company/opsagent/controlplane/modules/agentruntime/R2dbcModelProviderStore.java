package com.company.opsagent.controlplane.modules.agentruntime;

import java.time.Duration;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
import org.springframework.r2dbc.core.DatabaseClient;
import reactor.core.publisher.Mono;

/**
 * R2DBC-backed model provider store.
 */
public class R2dbcModelProviderStore implements ModelProviderStore {

  private final DatabaseClient databaseClient;

  public R2dbcModelProviderStore(DatabaseClient databaseClient) {
    this.databaseClient = databaseClient;
  }

  @Override
  public List<ModelProvider> list() {
    return databaseClient.sql("""
            select *
            from agent_model_provider
            order by created_at asc, provider_id asc
            """)
        .map((row, metadata) -> mapProvider(row))
        .all()
        .collectList()
        .block();
  }

  @Override
  public Optional<ModelProvider> findById(String providerId) {
    return databaseClient.sql("""
            select *
            from agent_model_provider
            where provider_id = :providerId
            """)
        .bind("providerId", providerId)
        .map((row, metadata) -> mapProvider(row))
        .one()
        .blockOptional();
  }

  @Override
  public Optional<ModelProvider> findDefault() {
    return databaseClient.sql("""
            select *
            from agent_model_provider
            where default_provider = true and enabled = true
            order by updated_at desc
            limit 1
            """)
        .map((row, metadata) -> mapProvider(row))
        .one()
        .blockOptional();
  }

  @Override
  public ModelProvider save(ModelProvider provider) {
    boolean exists = findById(provider.providerId()).isPresent();
    if (exists) {
      update(provider);
    } else {
      insert(provider);
    }
    return findById(provider.providerId()).orElseThrow();
  }

  @Override
  public ModelProvider setDefault(String providerId) {
    if (findById(providerId).isEmpty()) {
      throw new IllegalArgumentException("model provider not found");
    }
    databaseClient.sql("update agent_model_provider set default_provider = false")
        .fetch()
        .rowsUpdated()
        .block();
    databaseClient.sql("""
            update agent_model_provider
            set default_provider = true
            where provider_id = :providerId
            """)
        .bind("providerId", providerId)
        .fetch()
        .rowsUpdated()
        .block();
    return findById(providerId).orElseThrow();
  }

  private void insert(ModelProvider provider) {
    bindProvider(databaseClient.sql("""
            insert into agent_model_provider (
              provider_id,
              display_name,
              provider_type,
              base_url,
              model_name,
              enabled,
              default_provider,
              timeout_seconds,
              max_iterations,
              max_tool_calls,
              max_tool_call_duration_seconds,
              api_key_ciphertext,
              api_key_nonce,
              api_key_algorithm,
              api_key_fingerprint,
              api_key_last_rotated_at,
              config_version,
              created_by,
              created_at,
              updated_by,
              updated_at
            ) values (
              :providerId,
              :displayName,
              :providerType,
              :baseUrl,
              :modelName,
              :enabled,
              :defaultProvider,
              :timeoutSeconds,
              :maxIterations,
              :maxToolCalls,
              :maxToolCallDurationSeconds,
              :apiKeyCiphertext,
              :apiKeyNonce,
              :apiKeyAlgorithm,
              :apiKeyFingerprint,
              :apiKeyLastRotatedAt,
              :configVersion,
              :createdBy,
              :createdAt,
              :updatedBy,
              :updatedAt
            )
            """), provider)
        .fetch()
        .rowsUpdated()
        .block();
  }

  private void update(ModelProvider provider) {
    bindProvider(databaseClient.sql("""
            update agent_model_provider
            set display_name = :displayName,
                provider_type = :providerType,
                base_url = :baseUrl,
                model_name = :modelName,
                enabled = :enabled,
                default_provider = :defaultProvider,
                timeout_seconds = :timeoutSeconds,
                max_iterations = :maxIterations,
                max_tool_calls = :maxToolCalls,
                max_tool_call_duration_seconds = :maxToolCallDurationSeconds,
                api_key_ciphertext = :apiKeyCiphertext,
                api_key_nonce = :apiKeyNonce,
                api_key_algorithm = :apiKeyAlgorithm,
                api_key_fingerprint = :apiKeyFingerprint,
                api_key_last_rotated_at = :apiKeyLastRotatedAt,
                config_version = :configVersion,
                created_by = :createdBy,
                created_at = :createdAt,
                updated_by = :updatedBy,
                updated_at = :updatedAt
            where provider_id = :providerId
            """), provider)
        .fetch()
        .rowsUpdated()
        .block();
  }

  private DatabaseClient.GenericExecuteSpec bindProvider(
      DatabaseClient.GenericExecuteSpec spec,
      ModelProvider provider) {
    return spec
        .bind("providerId", provider.providerId())
        .bind("displayName", provider.displayName())
        .bind("providerType", provider.providerType().name())
        .bind("baseUrl", provider.baseUrl())
        .bind("modelName", provider.modelName())
        .bind("enabled", provider.enabled())
        .bind("defaultProvider", provider.defaultProvider())
        .bind("timeoutSeconds", provider.timeout().toSeconds())
        .bind("maxIterations", provider.maxIterations())
        .bind("maxToolCalls", provider.maxToolCalls())
        .bind("maxToolCallDurationSeconds", provider.maxToolCallDuration().toSeconds())
        .bind("apiKeyCiphertext", provider.apiKeyCiphertext())
        .bind("apiKeyNonce", provider.apiKeyNonce())
        .bind("apiKeyAlgorithm", provider.apiKeyAlgorithm())
        .bind("apiKeyFingerprint", provider.apiKeyFingerprint())
        .bind("apiKeyLastRotatedAt", provider.apiKeyLastRotatedAt())
        .bind("configVersion", provider.configVersion())
        .bind("createdBy", provider.createdBy())
        .bind("createdAt", provider.createdAt())
        .bind("updatedBy", provider.updatedBy())
        .bind("updatedAt", provider.updatedAt());
  }

  private ModelProvider mapProvider(io.r2dbc.spi.Row row) {
    return new ModelProvider(
        row.get("provider_id", String.class),
        row.get("display_name", String.class),
        ModelProviderType.valueOf(row.get("provider_type", String.class)),
        row.get("base_url", String.class),
        row.get("model_name", String.class),
        Boolean.TRUE.equals(row.get("enabled", Boolean.class)),
        Boolean.TRUE.equals(row.get("default_provider", Boolean.class)),
        Duration.ofSeconds(number(row.get("timeout_seconds")).longValue()),
        number(row.get("max_iterations")).intValue(),
        number(row.get("max_tool_calls")).intValue(),
        Duration.ofSeconds(number(row.get("max_tool_call_duration_seconds")).longValue()),
        row.get("api_key_ciphertext", String.class),
        row.get("api_key_nonce", String.class),
        row.get("api_key_algorithm", String.class),
        row.get("api_key_fingerprint", String.class),
        row.get("api_key_last_rotated_at", OffsetDateTime.class),
        number(row.get("config_version")).longValue(),
        row.get("created_by", String.class),
        row.get("created_at", OffsetDateTime.class),
        row.get("updated_by", String.class),
        row.get("updated_at", OffsetDateTime.class));
  }

  private Number number(Object value) {
    if (value instanceof Number number) {
      return number;
    }
    return Mono.justOrEmpty(value)
        .map(Object::toString)
        .map(Long::parseLong)
        .blockOptional()
        .orElseThrow(() -> new IllegalArgumentException("numeric value is missing"));
  }
}
