package com.company.opsagent.controlplane.modules.sqlworkbench;

import com.company.opsagent.contracts.sqlworkbench.SqlAssistantResponse;

public interface SqlAssistantClient {

  SqlAssistantResponse ask(SqlAssistantPrompt prompt);
}
