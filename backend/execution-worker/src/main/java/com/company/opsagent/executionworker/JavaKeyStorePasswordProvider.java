package com.company.opsagent.executionworker;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.security.GeneralSecurityException;
import java.security.KeyStore;
import javax.crypto.SecretKey;

/**
 * 使用管理员启动时提供的口令解锁 Java KeyStore。
 */
public class JavaKeyStorePasswordProvider implements SqlPasswordProvider {

  private final KeyStore keyStore;
  private final char[] storePassword;

  public JavaKeyStorePasswordProvider(Path path, char[] storePassword) {
    this.storePassword = storePassword.clone();
    try {
      keyStore = KeyStore.getInstance("JCEKS");
      try (var input = Files.newInputStream(path)) {
        keyStore.load(input, this.storePassword);
      }
    } catch (GeneralSecurityException | IOException exception) {
      throw new IllegalStateException("failed to unlock SQL credential KeyStore", exception);
    }
  }

  @Override
  public char[] password(String credentialAlias) {
    try {
      KeyStore.Entry entry = keyStore.getEntry(
          credentialAlias,
          new KeyStore.PasswordProtection(storePassword));
      if (!(entry instanceof KeyStore.SecretKeyEntry secretKeyEntry)) {
        throw new IllegalArgumentException("SQL credential alias is not available");
      }
      SecretKey secretKey = secretKeyEntry.getSecretKey();
      return new String(secretKey.getEncoded(), StandardCharsets.UTF_8).toCharArray();
    } catch (GeneralSecurityException exception) {
      throw new IllegalStateException("failed to read SQL credential alias", exception);
    }
  }
}
