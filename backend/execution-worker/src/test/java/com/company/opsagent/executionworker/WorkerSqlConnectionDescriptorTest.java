package com.company.opsagent.executionworker;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import org.junit.jupiter.api.Test;

/**
 * 验证 Worker SQL 出口连接目录项的本地安全约束。
 */
class WorkerSqlConnectionDescriptorTest {

  /**
   * 验证开发环境只读连接目录项可以被正常构造。
   */
  @Test
  void acceptsDevelopmentConnectionDescriptor() {
    var descriptor = new WorkerSqlConnectionDescriptor(
        "as400-dev-readonly",
        "development",
        "as400-dev.internal",
        446,
        "as400-dev-readonly",
        true);

    assertEquals("as400-dev-readonly", descriptor.connectionId());
    assertEquals("development", descriptor.targetEnvironment());
    assertEquals("as400-dev.internal", descriptor.host());
    assertEquals(446, descriptor.port());
  }

  /**
   * 验证 P1 Worker 本地连接目录不允许生产环境目标。
   */
  @Test
  void rejectsProductionConnectionDescriptor() {
    assertThrows(IllegalArgumentException.class, () -> new WorkerSqlConnectionDescriptor(
        "as400-prod-readonly",
        "production",
        "as400-prod.internal",
        446,
        "as400-prod-readonly",
        true));
  }

  /**
   * 验证 host/port allowlist 目标和连接目录都拒绝非法端口。
   */
  @Test
  void rejectsInvalidPort() {
    assertThrows(IllegalArgumentException.class, () -> new WorkerSqlEgressTarget("as400-dev.internal", 0));
    assertThrows(IllegalArgumentException.class, () -> new WorkerSqlConnectionDescriptor(
        "as400-dev-readonly",
        "development",
        "as400-dev.internal",
        70000,
        "as400-dev-readonly",
        true));
  }
}
