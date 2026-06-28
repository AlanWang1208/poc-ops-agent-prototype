package com.company.opsagent.controlplane.modules.agentruntime;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.time.Duration;
import java.time.OffsetDateTime;
import org.junit.jupiter.api.Test;

class InMemoryModelProviderStoreTest {

  @Test
  void settingDefaultProviderClearsPreviousDefault() {
    InMemoryModelProviderStore store = new InMemoryModelProviderStore();
    store.save(provider("provider-1", false));
    store.save(provider("provider-2", false));

    store.setDefault("provider-1");
    store.setDefault("provider-2");

    assertFalse(store.findById("provider-1").orElseThrow().defaultProvider());
    assertTrue(store.findById("provider-2").orElseThrow().defaultProvider());
    assertEquals("provider-2", store.findDefault().orElseThrow().providerId());
  }

  @Test
  void listReturnsStableCreationOrder() {
    InMemoryModelProviderStore store = new InMemoryModelProviderStore();
    store.save(provider("provider-1", false));
    store.save(provider("provider-2", false));

    assertEquals(
        java.util.List.of("provider-1", "provider-2"),
        store.list().stream().map(ModelProvider::providerId).toList());
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
