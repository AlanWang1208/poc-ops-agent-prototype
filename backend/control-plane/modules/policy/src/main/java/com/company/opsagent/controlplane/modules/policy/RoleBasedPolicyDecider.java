package com.company.opsagent.controlplane.modules.policy;

import com.company.opsagent.controlplane.modules.identity.OperatorIdentity;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * 基于角色的策略决策器。
 *
 * <p>当前实现使用最直接的 RBAC 规则：当主体拥有某动作所需角色之一时允许访问，否则拒绝。
 */
public class RoleBasedPolicyDecider implements PolicyDecisionService {

  private final String policyVersion;
  private final Map<String, Set<String>> requiredRolesByAction;

  public RoleBasedPolicyDecider(
      String policyVersion,
      Map<String, List<String>> requiredRolesByAction) {
    this.policyVersion = policyVersion;
    LinkedHashMap<String, Set<String>> normalized = new LinkedHashMap<>();
    requiredRolesByAction.forEach((action, roles) -> normalized.put(action, new LinkedHashSet<>(roles)));
    this.requiredRolesByAction = Map.copyOf(normalized);
  }

  /**
   * 对一次访问请求做角色匹配决策。
   */
  @Override
  public PolicyDecision decide(
      OperatorIdentity identity,
      String action,
      String resource) {
    Set<String> requiredRoles = requiredRolesByAction.get(action);
    if (requiredRoles == null) {
      return new PolicyDecision(action, resource, policyVersion, false, "no policy rule for action");
    }
    boolean allowed = identity.roles().stream().anyMatch(requiredRoles::contains);
    return new PolicyDecision(
        action,
        resource,
        policyVersion,
        allowed,
        allowed ? "granted by role" : "missing required role");
  }

  /**
   * 返回当前策略版本号。
   */
  @Override
  public String policyVersion() {
    return policyVersion;
  }
}
