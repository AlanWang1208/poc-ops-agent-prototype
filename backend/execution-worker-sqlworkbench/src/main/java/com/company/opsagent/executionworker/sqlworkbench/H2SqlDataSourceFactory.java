package com.company.opsagent.executionworker.sqlworkbench;

import java.sql.SQLException;
import java.util.Locale;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentMap;
import javax.sql.DataSource;
import org.h2.jdbcx.JdbcDataSource;

/**
 * Creates Worker-local H2 data sources for development and test diagnostics.
 */
public final class H2SqlDataSourceFactory {

  private final ConcurrentMap<String, DataSource> dataSources = new ConcurrentHashMap<>();

  public DataSource create(WorkerSqlConnectionDescriptor descriptor) {
    return dataSources.computeIfAbsent(descriptor.connectionId(), this::createInitializedDataSource);
  }

  private DataSource createInitializedDataSource(String connectionId) {
    JdbcDataSource dataSource = new JdbcDataSource();
    dataSource.setURL("jdbc:h2:mem:" + databaseName(connectionId) + ";DB_CLOSE_DELAY=-1;DATABASE_TO_UPPER=TRUE");
    initialize(dataSource);
    return dataSource;
  }

  private void initialize(DataSource dataSource) {
    try (var connection = dataSource.getConnection();
        var statement = connection.createStatement()) {
      statement.execute("""
          CREATE TABLE IF NOT EXISTS PUBLIC.ORDERS (
            ORDER_ID INTEGER PRIMARY KEY,
            STATUS VARCHAR(24) NOT NULL,
            AMOUNT DECIMAL(12, 2) NOT NULL,
            CUSTOMER_ID VARCHAR(48) NOT NULL,
            CREATED_AT TIMESTAMP NOT NULL
          )
          """);
      statement.execute("""
          MERGE INTO PUBLIC.ORDERS KEY(ORDER_ID)
          VALUES
            (1, 'READY', 128.50, 'CUST-001', TIMESTAMP '2026-06-27 09:00:00'),
            (2, 'PENDING', 256.75, 'CUST-002', TIMESTAMP '2026-06-27 10:00:00')
          """);
    } catch (SQLException exception) {
      throw new IllegalStateException("H2 SQL data source initialization failed", exception);
    }
  }

  private String databaseName(String connectionId) {
    String normalized = connectionId.toLowerCase(Locale.ROOT).replaceAll("[^a-z0-9]+", "_");
    if (normalized.isBlank()) {
      return "ops_agent_sql";
    }
    return normalized;
  }
}
