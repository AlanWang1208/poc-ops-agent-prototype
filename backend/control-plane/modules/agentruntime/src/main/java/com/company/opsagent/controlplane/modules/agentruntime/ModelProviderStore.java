package com.company.opsagent.controlplane.modules.agentruntime;

import java.util.List;
import java.util.Optional;

/**
 * Model provider persistence port.
 */
public interface ModelProviderStore {

  List<ModelProvider> list();

  Optional<ModelProvider> findById(String providerId);

  Optional<ModelProvider> findDefault();

  ModelProvider save(ModelProvider provider);

  ModelProvider setDefault(String providerId);
}
