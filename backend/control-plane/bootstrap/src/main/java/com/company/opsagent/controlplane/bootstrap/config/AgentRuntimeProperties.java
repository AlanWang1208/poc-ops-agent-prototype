package com.company.opsagent.controlplane.bootstrap.config;

import java.time.Duration;
import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * AgentScope primary runtime bootstrap settings.
 */
@ConfigurationProperties(prefix = "ops-agent.agent-runtime")
public class AgentRuntimeProperties {

  private boolean enabled;
  private String provider = "agentscope";
  private String modelName = "";
  private String baseUrl = "";
  private String apiKey = "";
  private String apiKeyEnv = "AGENTSCOPE_API_KEY";
  private Duration timeout = Duration.ofSeconds(30);
  private int maxToolCalls = 5;
  private Duration maxToolCallDuration = Duration.ofSeconds(30);
  private int maxIterations = 5;
  private boolean p1ReadOnlyOnly = true;
  private String workspaceId = "workspace-default";
  private String workspaceCode = "default";
  private String workspaceDisplayName = "Default Workspace";

  public boolean isEnabled() {
    return enabled;
  }

  public void setEnabled(boolean enabled) {
    this.enabled = enabled;
  }

  public String getProvider() {
    return provider;
  }

  public void setProvider(String provider) {
    this.provider = provider;
  }

  public String getModelName() {
    return modelName;
  }

  public void setModelName(String modelName) {
    this.modelName = modelName;
  }

  public String getBaseUrl() {
    return baseUrl;
  }

  public void setBaseUrl(String baseUrl) {
    this.baseUrl = baseUrl;
  }

  public String getApiKey() {
    return apiKey;
  }

  public void setApiKey(String apiKey) {
    this.apiKey = apiKey;
  }

  public String getApiKeyEnv() {
    return apiKeyEnv;
  }

  public void setApiKeyEnv(String apiKeyEnv) {
    this.apiKeyEnv = apiKeyEnv;
  }

  public Duration getTimeout() {
    return timeout;
  }

  public void setTimeout(Duration timeout) {
    this.timeout = timeout;
  }

  public int getMaxToolCalls() {
    return maxToolCalls;
  }

  public void setMaxToolCalls(int maxToolCalls) {
    this.maxToolCalls = maxToolCalls;
  }

  public Duration getMaxToolCallDuration() {
    return maxToolCallDuration;
  }

  public void setMaxToolCallDuration(Duration maxToolCallDuration) {
    this.maxToolCallDuration = maxToolCallDuration;
  }

  public int getMaxIterations() {
    return maxIterations;
  }

  public void setMaxIterations(int maxIterations) {
    this.maxIterations = maxIterations;
  }

  public boolean isP1ReadOnlyOnly() {
    return p1ReadOnlyOnly;
  }

  public void setP1ReadOnlyOnly(boolean p1ReadOnlyOnly) {
    this.p1ReadOnlyOnly = p1ReadOnlyOnly;
  }

  public String getWorkspaceId() {
    return workspaceId;
  }

  public void setWorkspaceId(String workspaceId) {
    this.workspaceId = workspaceId;
  }

  public String getWorkspaceCode() {
    return workspaceCode;
  }

  public void setWorkspaceCode(String workspaceCode) {
    this.workspaceCode = workspaceCode;
  }

  public String getWorkspaceDisplayName() {
    return workspaceDisplayName;
  }

  public void setWorkspaceDisplayName(String workspaceDisplayName) {
    this.workspaceDisplayName = workspaceDisplayName;
  }
}
