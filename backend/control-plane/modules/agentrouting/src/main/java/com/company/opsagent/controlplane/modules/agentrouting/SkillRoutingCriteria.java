package com.company.opsagent.controlplane.modules.agentrouting;

import com.company.opsagent.controlplane.modules.skillregistry.SkillCategory;
import com.company.opsagent.controlplane.modules.skillregistry.SkillPublicationStatus;
import com.company.opsagent.controlplane.modules.skillregistry.SkillRiskLevel;
import java.util.List;

/**
 * Skill 路由筛选条件。
 *
 * @param skillId 精确 SkillId，可为空
 * @param workspaceId 当前 Team Workspace，可为空
 * @param workspaceEnabledSkillIds 当前工作空间启用的 SkillId 集合；为空时不额外限制
 * @param category 期望分类，可为空
 * @param maxRiskLevel 可接受的最大风险等级，可为空
 * @param requiredParameters 请求方要求 Skill 至少具备的参数名集合
 * @param requiredTags 请求方希望命中的 Skill 标签集合
 * @param requestContextTags 请求上下文标签，用于灰度命中和环境筛选
 * @param publicationStatusRequired 是否要求特定发布状态
 */
public record SkillRoutingCriteria(
    String skillId,
    String workspaceId,
    List<String> workspaceEnabledSkillIds,
    SkillCategory category,
    SkillRiskLevel maxRiskLevel,
    List<String> requiredParameters,
    List<String> requiredTags,
    List<String> requestContextTags,
    SkillPublicationStatus publicationStatusRequired) {

  public SkillRoutingCriteria(
      String skillId,
      SkillCategory category,
      SkillRiskLevel maxRiskLevel,
      List<String> requiredParameters,
      List<String> requiredTags,
      List<String> requestContextTags,
      SkillPublicationStatus publicationStatusRequired) {
    this(
        skillId,
        null,
        List.of(),
        category,
        maxRiskLevel,
        requiredParameters,
        requiredTags,
        requestContextTags,
        publicationStatusRequired);
  }

  /**
   * 对集合做防御性复制。
   */
  public SkillRoutingCriteria {
    workspaceEnabledSkillIds = workspaceEnabledSkillIds == null ? List.of() : List.copyOf(workspaceEnabledSkillIds);
    requiredParameters = requiredParameters == null ? List.of() : List.copyOf(requiredParameters);
    requiredTags = requiredTags == null ? List.of() : List.copyOf(requiredTags);
    requestContextTags = requestContextTags == null ? List.of() : List.copyOf(requestContextTags);
  }
}
