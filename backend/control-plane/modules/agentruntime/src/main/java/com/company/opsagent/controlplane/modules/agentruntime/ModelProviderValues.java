package com.company.opsagent.controlplane.modules.agentruntime;

import java.net.URI;
import java.time.Duration;
import java.time.OffsetDateTime;
import java.util.Locale;

final class ModelProviderValues {

  private ModelProviderValues() {
  }

  static String requiredText(String value, String fieldName) {
    if (value == null || value.isBlank()) {
      throw new IllegalArgumentException(fieldName + " must not be blank");
    }
    return value.strip();
  }

  static OffsetDateTime requiredTime(OffsetDateTime value, String fieldName) {
    if (value == null) {
      throw new IllegalArgumentException(fieldName + " must not be null");
    }
    return value;
  }

  static Duration positiveDuration(Duration value, String fieldName) {
    if (value == null || value.isZero() || value.isNegative()) {
      throw new IllegalArgumentException(fieldName + " must be positive");
    }
    return value;
  }

  static int positiveInt(int value, String fieldName) {
    if (value < 1) {
      throw new IllegalArgumentException(fieldName + " must be positive");
    }
    return value;
  }

  static String validBaseUrl(String value) {
    String baseUrl = requiredText(value, "baseUrl");
    URI uri = URI.create(baseUrl);
    String scheme = uri.getScheme();
    String host = uri.getHost();
    if (scheme == null || host == null) {
      throw new IllegalArgumentException("baseUrl must include scheme and host");
    }
    String normalizedScheme = scheme.toLowerCase(Locale.ROOT);
    String normalizedHost = host.toLowerCase(Locale.ROOT);
    boolean localHttp = "http".equals(normalizedScheme)
        && ("127.0.0.1".equals(normalizedHost) || "localhost".equals(normalizedHost));
    if (!"https".equals(normalizedScheme) && !localHttp) {
      throw new IllegalArgumentException("baseUrl must use https outside local development");
    }
    return baseUrl;
  }
}
