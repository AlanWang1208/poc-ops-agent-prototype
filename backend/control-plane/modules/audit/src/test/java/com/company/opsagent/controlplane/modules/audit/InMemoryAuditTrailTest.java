package com.company.opsagent.controlplane.modules.audit;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.time.OffsetDateTime;
import org.junit.jupiter.api.Test;

/**
 * {@link InMemoryAuditTrail} 单元测试。
 *
 * <p>验证事件追加顺序和 latest 查询语义。
 */
class InMemoryAuditTrailTest {

  @Test
  void keepsLatestEvent() {
    // 连续记录两条事件后，latest 应返回最后追加的那一条。
    InMemoryAuditTrail auditTrail = new InMemoryAuditTrail();
    AuditEvent first = new AuditEvent("e-1", "r-1", "t-1", "alice", "a1", "/one", "rbac-v1", "ALLOW", "ok", OffsetDateTime.now());
    AuditEvent second = new AuditEvent("e-2", "r-2", "t-2", "bob", "a2", "/two", "rbac-v1", "DENY", "no", OffsetDateTime.now());

    auditTrail.record(first);
    auditTrail.record(second);

    assertEquals(2, auditTrail.snapshot().size());
    assertTrue(auditTrail.latest().isPresent());
    assertEquals("e-2", auditTrail.latest().orElseThrow().eventId());
  }
}
