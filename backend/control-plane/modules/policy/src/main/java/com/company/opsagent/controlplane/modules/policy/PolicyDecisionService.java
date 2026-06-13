package com.company.opsagent.controlplane.modules.policy;

import com.company.opsagent.controlplane.modules.identity.OperatorIdentity;

/**
 * 策略决策服务接口。
 *
 * <p>上层授权过滤器只依赖这个接口，从而允许后续把当前的内置 RBAC 实现替换为独立策略源。
 */
public interface PolicyDecisionService {

  /**
   * 针对指定主体、动作和资源做一次策略决策。
   */
  PolicyDecision decide(OperatorIdentity identity, String action, String resource);

  /**
   * 返回当前策略版本号。
   */
  String policyVersion();
}
