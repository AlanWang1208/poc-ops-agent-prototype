package com.company.opsagent.controlplane.modules.agentruntime;

import io.agentscope.core.model.ToolSchema;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

public final class AgentscopeToolSchemaFactory {

  private AgentscopeToolSchemaFactory() {
  }

  public static List<ToolSchema> fromCatalog(List<AgentToolDescriptor> catalog) {
    return catalog.stream()
        .filter(AgentToolDescriptor::isReadOnly)
        .map(AgentscopeToolSchemaFactory::toSchema)
        .toList();
  }

  private static ToolSchema toSchema(AgentToolDescriptor descriptor) {
    return ToolSchema.builder()
        .name(descriptor.skillId())
        .description(descriptor.description())
        .parameters(parameterSchema(descriptor.parameterNames()))
        .outputSchema(Map.of(
            "type", "object",
            "schemaId", descriptor.outputSchemaId()))
        .strict(true)
        .build();
  }

  private static Map<String, Object> parameterSchema(List<String> parameterNames) {
    Map<String, Object> properties = new LinkedHashMap<>();
    for (String parameterName : parameterNames) {
      properties.put(parameterName, Map.of("type", "string"));
    }
    return Map.of(
        "type", "object",
        "properties", properties,
        "required", parameterNames);
  }
}
