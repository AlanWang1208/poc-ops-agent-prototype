package com.company.opsagent.controlplane.modules.agentruntime;

/**
 * Encrypts and decrypts model provider API Keys.
 */
public interface ModelProviderSecretCodec {

  EncryptedSecret encrypt(String plaintext);

  String decrypt(EncryptedSecret encryptedSecret);

  record EncryptedSecret(
      String ciphertext,
      String nonce,
      String algorithm,
      String fingerprint) {

    public EncryptedSecret {
      ciphertext = ModelProviderValues.requiredText(ciphertext, "ciphertext");
      nonce = ModelProviderValues.requiredText(nonce, "nonce");
      algorithm = ModelProviderValues.requiredText(algorithm, "algorithm");
      fingerprint = ModelProviderValues.requiredText(fingerprint, "fingerprint");
    }
  }
}
