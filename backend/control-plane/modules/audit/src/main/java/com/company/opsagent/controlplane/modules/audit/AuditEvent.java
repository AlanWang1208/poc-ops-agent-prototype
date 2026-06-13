package com.company.opsagent.controlplane.modules.audit;

import java.time.OffsetDateTime;

/**
 * 审计事件模型。
 *
 * @param eventId 审计事件唯一标识
 * @param requestId 请求标识
 * @param traceId 追踪标识
 * @param subject 触发动作的主体
 * @param action 审计动作标识
 * @param resource 资源路径或资源标识
 * @param policyVersion 产生结果时使用的策略版本
 * @param result 决策结果，如 ALLOW / DENY
 * @param reason 决策说明
 * @param timestamp 事件生成时间
 */
public record AuditEvent(
    String eventId,
    String requestId,
    String traceId,
    String subject,
    String action,
    String resource,
    String policyVersion,
    String result,
    String reason,
    OffsetDateTime timestamp) {
}
