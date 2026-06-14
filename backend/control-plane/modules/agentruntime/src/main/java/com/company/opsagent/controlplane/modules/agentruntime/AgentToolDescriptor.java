package com.company.opsagent.controlplane.modules.agentruntime;

import java.util.List;

/**
 * 暴露给主 Agent Runtime 的脱敏 Tool 描述。
 */
public record AgentToolDescriptor(
    String skillId,
    String version,
    String description,
    String parameterSchemaId,
    String outputSchemaId,
    List<String> parameterNames,
    String riskLevel) {

  public AgentToolDescriptor {
    skillId = requiredText(skillId, "skillId");
    version = requiredText(version, "version");
    description = requiredText(description, "description");
    parameterSchemaId = requiredText(parameterSchemaId, "parameterSchemaId");
    outputSchemaId = requiredText(outputSchemaId, "outputSchemaId");
    parameterNames = List.copyOf(parameterNames == null ? List.of() : parameterNames);
    riskLevel = requiredText(riskLevel, "riskLevel");
  }

  boolean matches(String requestedSkillId, String requestedVersion) {
    return skillId.equals(requestedSkillId) && version.equals(requestedVersion);
  }

  boolean isReadOnly() {
    return "READ_ONLY".equals(riskLevel);
  }

  private static String requiredText(String value, String fieldName) {
    if (value == null || value.isBlank()) {
      throw new IllegalArgumentException(fieldName + " must not be blank");
    }
    return value;
  }
}
