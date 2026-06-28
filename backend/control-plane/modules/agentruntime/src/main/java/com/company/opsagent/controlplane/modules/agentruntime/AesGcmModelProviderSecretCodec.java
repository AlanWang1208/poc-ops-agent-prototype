package com.company.opsagent.controlplane.modules.agentruntime;

import java.nio.charset.StandardCharsets;
import java.security.GeneralSecurityException;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.util.Arrays;
import java.util.Base64;
import javax.crypto.Cipher;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;

/**
 * AES-GCM API Key codec backed by an environment supplied master key.
 */
public final class AesGcmModelProviderSecretCodec implements ModelProviderSecretCodec {

  private static final String ALGORITHM = "AES_GCM_V1";
  private static final String CIPHER = "AES/GCM/NoPadding";
  private static final int GCM_TAG_BITS = 128;
  private static final int NONCE_BYTES = 12;
  private static final int FINGERPRINT_BYTES = 8;

  private final SecretKeySpec keySpec;
  private final SecureRandom secureRandom;

  public AesGcmModelProviderSecretCodec(String masterKey) {
    this(masterKey, new SecureRandom());
  }

  AesGcmModelProviderSecretCodec(String masterKey, SecureRandom secureRandom) {
    byte[] keyBytes = normalizeKey(ModelProviderValues.requiredText(masterKey, "masterKey"));
    this.keySpec = new SecretKeySpec(keyBytes, "AES");
    this.secureRandom = secureRandom;
  }

  @Override
  public EncryptedSecret encrypt(String plaintext) {
    String secret = ModelProviderValues.requiredText(plaintext, "plaintext");
    byte[] nonce = new byte[NONCE_BYTES];
    secureRandom.nextBytes(nonce);
    try {
      Cipher cipher = Cipher.getInstance(CIPHER);
      cipher.init(Cipher.ENCRYPT_MODE, keySpec, new GCMParameterSpec(GCM_TAG_BITS, nonce));
      byte[] encrypted = cipher.doFinal(secret.getBytes(StandardCharsets.UTF_8));
      return new EncryptedSecret(
          Base64.getEncoder().encodeToString(encrypted),
          Base64.getEncoder().encodeToString(nonce),
          ALGORITHM,
          fingerprint(secret));
    } catch (GeneralSecurityException exception) {
      throw new IllegalStateException("failed to encrypt model provider secret", exception);
    }
  }

  @Override
  public String decrypt(EncryptedSecret encryptedSecret) {
    if (!ALGORITHM.equals(encryptedSecret.algorithm())) {
      throw new IllegalArgumentException("unsupported model provider secret algorithm");
    }
    try {
      Cipher cipher = Cipher.getInstance(CIPHER);
      byte[] nonce = Base64.getDecoder().decode(encryptedSecret.nonce());
      cipher.init(Cipher.DECRYPT_MODE, keySpec, new GCMParameterSpec(GCM_TAG_BITS, nonce));
      byte[] decrypted = cipher.doFinal(Base64.getDecoder().decode(encryptedSecret.ciphertext()));
      return new String(decrypted, StandardCharsets.UTF_8);
    } catch (IllegalArgumentException | GeneralSecurityException exception) {
      throw new IllegalStateException("failed to decrypt model provider secret", exception);
    }
  }

  private static byte[] normalizeKey(String masterKey) {
    byte[] raw = masterKey.getBytes(StandardCharsets.UTF_8);
    if (raw.length == 16 || raw.length == 24 || raw.length == 32) {
      return raw;
    }
    try {
      return MessageDigest.getInstance("SHA-256").digest(raw);
    } catch (GeneralSecurityException exception) {
      throw new IllegalStateException("failed to derive model provider master key", exception);
    }
  }

  private static String fingerprint(String plaintext) {
    try {
      byte[] digest = MessageDigest.getInstance("SHA-256")
          .digest(plaintext.getBytes(StandardCharsets.UTF_8));
      byte[] prefix = Arrays.copyOf(digest, FINGERPRINT_BYTES);
      return "fp_" + Base64.getUrlEncoder().withoutPadding().encodeToString(prefix);
    } catch (GeneralSecurityException exception) {
      throw new IllegalStateException("failed to fingerprint model provider secret", exception);
    }
  }
}
