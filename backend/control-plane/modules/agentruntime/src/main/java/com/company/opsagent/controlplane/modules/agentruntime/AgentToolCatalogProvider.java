package com.company.opsagent.controlplane.modules.agentruntime;

import java.util.List;

/**
 * 提供当前 Agent 任务可见的脱敏 Tool Catalog。
 */
@FunctionalInterface
public interface AgentToolCatalogProvider {

  List<AgentToolDescriptor> availableTools();
}
