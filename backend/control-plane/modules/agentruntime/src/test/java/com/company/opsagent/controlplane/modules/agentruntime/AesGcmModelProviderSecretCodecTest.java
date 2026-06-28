package com.company.opsagent.controlplane.modules.agentruntime;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import org.junit.jupiter.api.Test;

class AesGcmModelProviderSecretCodecTest {

  @Test
  void encryptsAndDecryptsApiKeyWithoutPlaintextInCiphertext() {
    AesGcmModelProviderSecretCodec codec = new AesGcmModelProviderSecretCodec(
        "0123456789abcdef0123456789abcdef");

    ModelProviderSecretCodec.EncryptedSecret encrypted = codec.encrypt("TEST_API_KEY_PLACEHOLDER");

    assertEquals("TEST_API_KEY_PLACEHOLDER", codec.decrypt(encrypted));
    assertFalse(encrypted.ciphertext().contains("TEST_API_KEY_PLACEHOLDER"));
    assertFalse(encrypted.nonce().isBlank());
    assertEquals("AES_GCM_V1", encrypted.algorithm());
    assertTrue(encrypted.fingerprint().startsWith("fp_"));
  }

  @Test
  void usesDifferentNonceForEachEncryption() {
    AesGcmModelProviderSecretCodec codec = new AesGcmModelProviderSecretCodec(
        "0123456789abcdef0123456789abcdef");

    ModelProviderSecretCodec.EncryptedSecret first = codec.encrypt("TEST_API_KEY_PLACEHOLDER");
    ModelProviderSecretCodec.EncryptedSecret second = codec.encrypt("TEST_API_KEY_PLACEHOLDER");

    assertNotEquals(first.nonce(), second.nonce());
    assertNotEquals(first.ciphertext(), second.ciphertext());
    assertEquals(first.fingerprint(), second.fingerprint());
  }

  @Test
  void rejectsBlankMasterKeyAndBlankSecret() {
    assertThrows(IllegalArgumentException.class, () -> new AesGcmModelProviderSecretCodec(" "));

    AesGcmModelProviderSecretCodec codec = new AesGcmModelProviderSecretCodec(
        "0123456789abcdef0123456789abcdef");

    assertThrows(IllegalArgumentException.class, () -> codec.encrypt(" "));
  }
}
