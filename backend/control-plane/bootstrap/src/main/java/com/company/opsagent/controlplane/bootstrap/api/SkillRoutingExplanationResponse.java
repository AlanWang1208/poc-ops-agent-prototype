package com.company.opsagent.controlplane.bootstrap.api;

import com.company.opsagent.controlplane.modules.agentrouting.SkillRouteCandidate;
import com.company.opsagent.controlplane.modules.skillregistry.SkillCategory;
import com.company.opsagent.controlplane.modules.skillregistry.SkillPublicationStatus;
import com.company.opsagent.controlplane.modules.skillregistry.SkillRiskLevel;
import java.util.List;

/**
 * Skill 路由解释响应。
 *
 * <p>该响应只描述确定性路由筛选结果，不表达授权允许或拒绝结论。
 *
 * @param explanationScope 解释范围，固定为路由解释
 * @param decisionBoundary 决策边界，说明授权仍由 M02 负责
 * @param total 命中的候选数量
 * @param candidates 排序后的候选列表
 * @param appliedConstraints 本次请求应用的路由约束摘要
 * @param topCandidate 顶级候选摘要，无候选时为空
 * @param summary 可审计的路由结果摘要
 * @param noCandidateReason 无候选时的说明，有候选时为空
 * @param matchedRules 顶级候选命中的路由规则，无候选时为空列表
 */
public record SkillRoutingExplanationResponse(
    String explanationScope,
    String decisionBoundary,
    int total,
    List<SkillRouteCandidate> candidates,
    AppliedRoutingConstraints appliedConstraints,
    TopRoutingCandidate topCandidate,
    String summary,
    String noCandidateReason,
    List<String> matchedRules) {

  private static final String EXPLANATION_SCOPE = "ROUTING_EXPLANATION_ONLY";
  private static final String DECISION_BOUNDARY = "ROUTING_ONLY_M02_AUTHORIZATION_REQUIRED";
  private static final String TOP_CANDIDATE_SUMMARY = "top routing candidate selected by deterministic constraints";
  private static final String NO_CANDIDATE_SUMMARY = "no routing candidate matched deterministic constraints";

  /**
   * 从请求条件和候选结果生成解释响应。
   */
  public static SkillRoutingExplanationResponse from(
      SkillRoutingRequest request,
      List<SkillRouteCandidate> candidates) {
    List<SkillRouteCandidate> orderedCandidates = List.copyOf(candidates);
    TopRoutingCandidate topCandidate = orderedCandidates.isEmpty()
        ? null
        : TopRoutingCandidate.from(orderedCandidates.getFirst());
    List<String> matchedRules = topCandidate == null ? List.of() : topCandidate.matchedRules();
    return new SkillRoutingExplanationResponse(
        EXPLANATION_SCOPE,
        DECISION_BOUNDARY,
        orderedCandidates.size(),
        orderedCandidates,
        AppliedRoutingConstraints.from(request),
        topCandidate,
        topCandidate == null ? NO_CANDIDATE_SUMMARY : TOP_CANDIDATE_SUMMARY,
        topCandidate == null ? "no registered skill matched the supplied routing constraints" : null,
        matchedRules);
  }

  /**
   * 防御性复制集合字段。
   */
  public SkillRoutingExplanationResponse {
    candidates = List.copyOf(candidates);
    matchedRules = List.copyOf(matchedRules);
  }

  /**
   * 路由约束摘要。
   */
  public record AppliedRoutingConstraints(
      String skillId,
      SkillCategory category,
      SkillRiskLevel maxRiskLevel,
      List<String> requiredParameters,
      List<String> requiredTags,
      List<String> requestContextTags,
      SkillPublicationStatus publicationStatusRequired) {

    private static AppliedRoutingConstraints from(SkillRoutingRequest request) {
      return new AppliedRoutingConstraints(
          request.skillId(),
          request.category(),
          request.maxRiskLevel(),
          request.requiredParameters(),
          request.requiredTags(),
          request.requestContextTags(),
          request.publicationStatusRequired());
    }

    /**
     * 防御性复制列表字段。
     */
    public AppliedRoutingConstraints {
      requiredParameters = List.copyOf(requiredParameters);
      requiredTags = List.copyOf(requiredTags);
      requestContextTags = List.copyOf(requestContextTags);
    }
  }

  /**
   * 顶级路由候选摘要。
   */
  public record TopRoutingCandidate(
      String skillId,
      String version,
      int score,
      List<String> matchedRules) {

    private static TopRoutingCandidate from(SkillRouteCandidate candidate) {
      return new TopRoutingCandidate(
          candidate.skill().descriptor().skillId(),
          candidate.skill().descriptor().version(),
          candidate.score(),
          candidate.matchedRules());
    }

    /**
     * 防御性复制命中规则。
     */
    public TopRoutingCandidate {
      matchedRules = List.copyOf(matchedRules);
    }
  }
}
