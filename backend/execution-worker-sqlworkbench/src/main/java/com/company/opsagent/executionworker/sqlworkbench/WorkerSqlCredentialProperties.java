package com.company.opsagent.executionworker.sqlworkbench;

import java.nio.file.Path;
import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * SQL Worker 本地凭据 KeyStore 配置。
 */
@ConfigurationProperties(prefix = "ops-agent.worker.sql-credentials")
public class WorkerSqlCredentialProperties {

  private Path keyStorePath;
  private String storePassword;

  public Path getKeyStorePath() {
    return keyStorePath;
  }

  public void setKeyStorePath(Path keyStorePath) {
    this.keyStorePath = keyStorePath;
  }

  public String getStorePassword() {
    return storePassword;
  }

  public void setStorePassword(String storePassword) {
    this.storePassword = storePassword;
  }

  public boolean isConfigured() {
    return keyStorePath != null || (storePassword != null && !storePassword.isBlank());
  }

  public boolean isComplete() {
    return keyStorePath != null && storePassword != null && !storePassword.isBlank();
  }
}
