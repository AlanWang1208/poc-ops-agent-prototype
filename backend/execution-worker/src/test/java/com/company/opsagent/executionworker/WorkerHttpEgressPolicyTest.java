package com.company.opsagent.executionworker;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import java.net.URI;
import java.util.List;
import org.junit.jupiter.api.Test;

/**
 * 验证 Worker HTTP 出口默认拒绝，并且只允许显式配置的 scheme、host 和 port。
 */
class WorkerHttpEgressPolicyTest {

  @Test
  void allowsConfiguredHttpTarget() {
    WorkerHttpEgressTarget target = policy().validate(URI.create("https://weather.internal/current"));

    assertEquals(new WorkerHttpEgressTarget("https", "weather.internal", 443), target);
  }

  @Test
  void rejectsTargetOutsideAllowlist() {
    WorkerHttpEgressException exception = assertThrows(
        WorkerHttpEgressException.class,
        () -> new WorkerHttpEgressPolicy(List.of())
            .validate(URI.create("https://weather.internal/current")));

    assertEquals("HTTP_EGRESS_NOT_ALLOWED", exception.errorCode());
  }

  @Test
  void rejectsUnsupportedScheme() {
    WorkerHttpEgressException exception = assertThrows(
        WorkerHttpEgressException.class,
        () -> policy().validate(URI.create("file:///tmp/weather.json")));

    assertEquals("HTTP_EGRESS_SCHEME_NOT_ALLOWED", exception.errorCode());
  }

  @Test
  void rejectsUserInfoInEndpoint() {
    WorkerHttpEgressException exception = assertThrows(
        WorkerHttpEgressException.class,
        () -> policy().validate(URI.create("https://user:secret@weather.internal/current")));

    assertEquals("HTTP_EGRESS_USERINFO_NOT_ALLOWED", exception.errorCode());
  }

  private WorkerHttpEgressPolicy policy() {
    return new WorkerHttpEgressPolicy(List.of(new WorkerHttpEgressTarget("https", "weather.internal", 443)));
  }
}
