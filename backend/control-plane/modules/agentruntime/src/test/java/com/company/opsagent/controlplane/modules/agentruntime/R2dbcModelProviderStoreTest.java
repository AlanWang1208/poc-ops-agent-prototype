package com.company.opsagent.controlplane.modules.agentruntime;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.time.Duration;
import java.time.OffsetDateTime;
import org.junit.jupiter.api.Test;
import org.springframework.core.io.ClassPathResource;
import org.springframework.r2dbc.connection.init.ConnectionFactoryInitializer;
import org.springframework.r2dbc.connection.init.ResourceDatabasePopulator;
import org.springframework.r2dbc.core.DatabaseClient;
import io.r2dbc.spi.ConnectionFactories;

class R2dbcModelProviderStoreTest {

  @Test
  void savesAndFindsModelProvider() {
    R2dbcModelProviderStore store = testStore();
    ModelProvider provider = provider("provider-1", false);

    store.save(provider);

    ModelProvider persisted = store.findById("provider-1").orElseThrow();
    assertEquals(provider.providerId(), persisted.providerId());
    assertEquals(provider.apiKeyCiphertext(), persisted.apiKeyCiphertext());
    assertEquals(provider.apiKeyFingerprint(), persisted.apiKeyFingerprint());
  }

  @Test
  void settingDefaultProviderClearsPreviousDefault() {
    R2dbcModelProviderStore store = testStore();
    store.save(provider("provider-1", false));
    store.save(provider("provider-2", false));

    store.setDefault("provider-1");
    store.setDefault("provider-2");

    assertFalse(store.findById("provider-1").orElseThrow().defaultProvider());
    assertTrue(store.findById("provider-2").orElseThrow().defaultProvider());
    assertEquals("provider-2", store.findDefault().orElseThrow().providerId());
  }

  private R2dbcModelProviderStore testStore() {
    var connectionFactory = ConnectionFactories.get(
        "r2dbc:h2:mem:///model-provider-store-" + System.nanoTime() + ";DB_CLOSE_DELAY=-1");
    var initializer = new ConnectionFactoryInitializer();
    initializer.setConnectionFactory(connectionFactory);
    initializer.setDatabasePopulator(new ResourceDatabasePopulator(
        new ClassPathResource("sql/migrations/V001__model_provider_schema.sql")));
    initializer.afterPropertiesSet();
    return new R2dbcModelProviderStore(DatabaseClient.create(connectionFactory));
  }

  private ModelProvider provider(String providerId, boolean defaultProvider) {
    OffsetDateTime now = OffsetDateTime.parse("2026-06-28T00:00:00Z");
    return new ModelProvider(
        providerId,
        providerId,
        ModelProviderType.OPENAI_COMPATIBLE,
        "https://api.openai.com/v1",
        "gpt-4.1-mini",
        true,
        defaultProvider,
        Duration.ofSeconds(30),
        5,
        5,
        Duration.ofSeconds(30),
        "ciphertext-" + providerId,
        "nonce-" + providerId,
        "AES_GCM_V1",
        "fp_" + providerId,
        now,
        1,
        "admin",
        now,
        "admin",
        now);
  }
}
