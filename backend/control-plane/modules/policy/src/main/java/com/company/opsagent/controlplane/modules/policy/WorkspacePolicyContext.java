package com.company.opsagent.controlplane.modules.policy;

/**
 * 策略决策使用的 Team Workspace 作用域上下文。
 *
 * @param workspaceId 当前请求选择的工作空间
 * @param skillId 当前请求涉及的 Skill，可为空
 * @param targetEnvironment 当前请求涉及的目标环境，可为空
 */
public record WorkspacePolicyContext(
    String workspaceId,
    String skillId,
    String targetEnvironment) {

  public WorkspacePolicyContext {
    if (workspaceId == null || workspaceId.isBlank()) {
      throw new IllegalArgumentException("workspaceId must not be blank");
    }
  }
}
