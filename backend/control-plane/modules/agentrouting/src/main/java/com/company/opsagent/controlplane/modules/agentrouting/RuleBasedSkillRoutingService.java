package com.company.opsagent.controlplane.modules.agentrouting;

import com.company.opsagent.controlplane.modules.skillregistry.RegisteredSkill;
import com.company.opsagent.controlplane.modules.skillregistry.SkillParameterDescriptor;
import com.company.opsagent.controlplane.modules.skillregistry.SkillPublicationStatus;
import com.company.opsagent.controlplane.modules.skillregistry.SkillReleaseManagementService;
import com.company.opsagent.controlplane.modules.skillregistry.SkillReleaseSnapshot;
import com.company.opsagent.controlplane.modules.skillregistry.SkillReleaseStage;
import com.company.opsagent.controlplane.modules.skillregistry.SkillRegistryService;
import com.company.opsagent.controlplane.modules.skillregistry.SkillRiskLevel;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * 基于规则的 Skill 路由服务。
 *
 * <p>当前阶段不引入模型推理，只基于 M03 的注册结果做确定性筛选：
 * SkillId、分类、风险、参数、标签和发布状态都必须在路由前被明确处理。
 */
public class RuleBasedSkillRoutingService implements SkillRoutingService {

  private final SkillRegistryService skillRegistryService;
  private final SkillReleaseManagementService skillReleaseManagementService;

  public RuleBasedSkillRoutingService(
      SkillRegistryService skillRegistryService,
      SkillReleaseManagementService skillReleaseManagementService) {
    this.skillRegistryService = skillRegistryService;
    this.skillReleaseManagementService = skillReleaseManagementService;
  }

  /**
   * 根据筛选条件返回排序后的候选列表。
   */
  @Override
  public List<SkillRouteCandidate> findCandidates(SkillRoutingCriteria criteria) {
    return skillRegistryService.listSkills().stream()
        .map(registeredSkill -> evaluate(registeredSkill, criteria))
        .filter(candidate -> candidate != null)
        .sorted(Comparator.comparingInt(SkillRouteCandidate::score).reversed()
            .thenComparing(candidate -> candidate.skill().descriptor().skillId())
            .thenComparing(candidate -> candidate.skill().descriptor().version(), Comparator.reverseOrder()))
        .toList();
  }

  private SkillRouteCandidate evaluate(RegisteredSkill skill, SkillRoutingCriteria criteria) {
    List<String> matchedRules = new ArrayList<>();
    int score = 0;
    SkillReleaseSnapshot releaseSnapshot = skillReleaseManagementService.snapshot(skill);

    if (releaseSnapshot.stage() == SkillReleaseStage.ROLLED_BACK) {
      return null;
    }

    if (releaseSnapshot.stage() == SkillReleaseStage.CANARY) {
      Set<String> requestContextTags = criteria.requestContextTags().stream()
          .map(this::normalize)
          .collect(Collectors.toSet());
      Set<String> targetContextTags = releaseSnapshot.targetContextTags().stream()
          .map(this::normalize)
          .collect(Collectors.toSet());
      if (!targetContextTags.isEmpty() && requestContextTags.stream().noneMatch(targetContextTags::contains)) {
        return null;
      }
      score += 5;
      matchedRules.add("命中灰度发布条件");
    } else {
      score += 15;
      matchedRules.add("命中全量发布版本");
    }

    if (criteria.skillId() != null && !criteria.skillId().isBlank()) {
      if (!skill.descriptor().skillId().equals(criteria.skillId())) {
        return null;
      }
      score += 100;
      matchedRules.add("精确匹配 skillId");
    }

    if (criteria.category() != null) {
      if (skill.descriptor().category() != criteria.category()) {
        return null;
      }
      score += 40;
      matchedRules.add("分类匹配");
    }

    if (criteria.maxRiskLevel() != null) {
      if (riskWeight(skill.descriptor().riskLevel()) > riskWeight(criteria.maxRiskLevel())) {
        return null;
      }
      score += 20;
      matchedRules.add("风险等级满足约束");
    }

    if (criteria.publicationStatusRequired() != null) {
      if (skill.publicationStatus() != criteria.publicationStatusRequired()) {
        return null;
      }
      score += 30;
      matchedRules.add("发布状态匹配");
    }

    Set<String> parameterNames = skill.descriptor().parameters().stream()
        .map(SkillParameterDescriptor::name)
        .map(this::normalize)
        .collect(Collectors.toSet());
    for (String requiredParameter : criteria.requiredParameters()) {
      if (!parameterNames.contains(normalize(requiredParameter))) {
        return null;
      }
    }
    if (!criteria.requiredParameters().isEmpty()) {
      score += criteria.requiredParameters().size() * 10;
      matchedRules.add("参数约束满足");
    }

    Set<String> tags = skill.descriptor().tags().stream()
        .map(this::normalize)
        .collect(Collectors.toSet());
    for (String requiredTag : criteria.requiredTags()) {
      if (!tags.contains(normalize(requiredTag))) {
        return null;
      }
    }
    if (!criteria.requiredTags().isEmpty()) {
      score += criteria.requiredTags().size() * 5;
      matchedRules.add("标签约束满足");
    }

    if (matchedRules.isEmpty()) {
      matchedRules.add("无额外筛选条件，按注册中心默认候选返回");
    }

    return new SkillRouteCandidate(skill, releaseSnapshot, score, matchedRules);
  }

  private int riskWeight(SkillRiskLevel riskLevel) {
    return switch (riskLevel) {
      case READ_ONLY -> 0;
      case LOW -> 1;
      case MEDIUM -> 2;
      case HIGH -> 3;
    };
  }

  private String normalize(String value) {
    return value == null ? "" : value.toLowerCase(Locale.ROOT);
  }
}
