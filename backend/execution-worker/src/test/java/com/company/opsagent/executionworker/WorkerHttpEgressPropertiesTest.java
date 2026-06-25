package com.company.opsagent.executionworker;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.net.URI;
import java.util.List;
import org.junit.jupiter.api.Test;

/**
 * 验证 Worker HTTP 出口配置只生成应用层 allowlist，不保存密钥或任意 URL。
 */
class WorkerHttpEgressPropertiesTest {

  @Test
  void convertsAllowedTargetsToPolicy() {
    WorkerHttpEgressProperties properties = new WorkerHttpEgressProperties();
    properties.setAllowedTargets(List.of(target("https", "weather.internal", 443)));

    WorkerHttpEgressTarget target = properties.toPolicy().validate(URI.create("https://weather.internal/current"));

    assertEquals(new WorkerHttpEgressTarget("https", "weather.internal", 443), target);
  }

  @Test
  void defaultsToEmptyList() {
    WorkerHttpEgressProperties properties = new WorkerHttpEgressProperties();

    assertTrue(properties.getAllowedTargets().isEmpty());
  }

  private WorkerHttpEgressProperties.Target target(String scheme, String host, int port) {
    WorkerHttpEgressProperties.Target target = new WorkerHttpEgressProperties.Target();
    target.setScheme(scheme);
    target.setHost(host);
    target.setPort(port);
    return target;
  }
}
