package com.company.opsagent.executionworker.sqlworkbench;

import com.company.opsagent.contracts.sqlworkbench.SqlQueryExecutionRequest;
import java.util.Arrays;
import javax.sql.DataSource;

/**
 * Resolves an approved SQL request to a Db2 for i DataSource using Worker-local connection bindings.
 */
public final class Jt400SqlDataSourceRegistry implements SqlDataSourceRegistry {

  private final WorkerSqlEgressPolicy egressPolicy;
  private final SqlPasswordProvider passwordProvider;
  private final Jt400DataSourceFactory dataSourceFactory;

  public Jt400SqlDataSourceRegistry(
      WorkerSqlEgressPolicy egressPolicy,
      SqlPasswordProvider passwordProvider,
      Jt400DataSourceFactory dataSourceFactory) {
    this.egressPolicy = egressPolicy;
    this.passwordProvider = passwordProvider;
    this.dataSourceFactory = dataSourceFactory;
  }

  @Override
  public DataSource resolve(SqlQueryExecutionRequest request) {
    WorkerSqlConnectionDescriptor descriptor = egressPolicy.validate(request);
    char[] password = passwordProvider.password(descriptor.credentialAlias());
    try {
      return dataSourceFactory.create(descriptor.host(), descriptor.username(), password);
    } finally {
      Arrays.fill(password, '\0');
    }
  }
}
