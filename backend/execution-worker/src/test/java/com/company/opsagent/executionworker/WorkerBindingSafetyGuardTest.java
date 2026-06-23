package com.company.opsagent.executionworker;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertThrows;

import org.junit.jupiter.api.Test;

/**
 * 验证 Worker 监听地址与传输认证之间的安全约束，避免生产误把未认证 Worker 暴露到非回环地址。
 */
class WorkerBindingSafetyGuardTest {

  /**
   * 验证本地回环开发模式允许关闭传输认证。
   */
  @Test
  void allowsLoopbackBindingWithoutTransportAuth() {
    assertDoesNotThrow(() -> new WorkerBindingSafetyGuard("127.0.0.1", auth(false)).validate());
    assertDoesNotThrow(() -> new WorkerBindingSafetyGuard("localhost", auth(false)).validate());
  }

  /**
   * 验证非回环地址在未启用传输认证时会被启动保护拒绝。
   */
  @Test
  void rejectsWildcardBindingWithoutTransportAuth() {
    assertThrows(IllegalStateException.class, () -> new WorkerBindingSafetyGuard("0.0.0.0", auth(false)).validate());
  }

  /**
   * 验证缺省监听地址不能被隐式当作回环地址，避免配置缺失时绕过非回环绑定保护。
   */
  @Test
  void rejectsMissingBindingAddressWithoutTransportAuth() {
    assertThrows(IllegalStateException.class, () -> new WorkerBindingSafetyGuard("", auth(false)).validate());
  }

  /**
   * 验证启用传输认证后可以通过非回环地址绑定保护。
   */
  @Test
  void allowsWildcardBindingWithTransportAuth() {
    assertDoesNotThrow(() -> new WorkerBindingSafetyGuard("0.0.0.0", auth(true)).validate());
  }

  private WorkerTransportAuthProperties auth(boolean enabled) {
    WorkerTransportAuthProperties properties = new WorkerTransportAuthProperties();
    properties.setEnabled(enabled);
    return properties;
  }
}
