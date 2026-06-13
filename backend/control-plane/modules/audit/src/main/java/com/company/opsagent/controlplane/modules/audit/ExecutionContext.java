package com.company.opsagent.controlplane.modules.audit;

import java.util.List;

/**
 * 请求级执行上下文。
 *
 * @param requestId 请求标识
 * @param traceId 链路追踪标识
 * @param subject 主体标识
 * @param username 用户名
 * @param roles 主体角色列表
 * @param action 当前执行动作
 * @param resource 当前访问资源
 * @param method HTTP 方法
 * @param path HTTP 路径
 * @param policyVersion 命中的策略版本
 */
public record ExecutionContext(
    String requestId,
    String traceId,
    String subject,
    String username,
    List<String> roles,
    String action,
    String resource,
    String method,
    String path,
    String policyVersion) {

  /**
   * 防御性复制角色集合，避免上下文被外部改写。
   */
  public ExecutionContext {
    roles = List.copyOf(roles);
  }
}
