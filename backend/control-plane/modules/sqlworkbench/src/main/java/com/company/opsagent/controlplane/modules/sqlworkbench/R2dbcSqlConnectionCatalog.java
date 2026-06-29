package com.company.opsagent.controlplane.modules.sqlworkbench;

import com.company.opsagent.contracts.sqlworkbench.SqlConnectionCreateRequest;
import com.company.opsagent.contracts.sqlworkbench.SqlConnectionSummary;
import com.company.opsagent.contracts.sqlworkbench.SqlConnectionUpdateRequest;
import com.company.opsagent.contracts.sqlworkbench.SqlQueryAction;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.List;
import java.util.Optional;
import java.util.regex.Pattern;
import org.springframework.r2dbc.core.DatabaseClient;
import reactor.core.publisher.Mono;

/**
 * R2DBC-backed SQL workbench connection catalog.
 */
public class R2dbcSqlConnectionCatalog implements SqlConnectionCatalog {

  private static final Pattern NON_ALPHANUMERIC = Pattern.compile("[^a-z0-9]+");
  private static final TypeReference<List<String>> STRING_LIST = new TypeReference<>() {
  };
  private static final TypeReference<List<SqlQueryAction>> ACTION_LIST = new TypeReference<>() {
  };

  private final DatabaseClient databaseClient;
  private final ObjectMapper objectMapper;

  public R2dbcSqlConnectionCatalog(DatabaseClient databaseClient, ObjectMapper objectMapper) {
    this.databaseClient = databaseClient;
    this.objectMapper = objectMapper;
  }

  @Override
  public List<SqlConnectionSummary> list() {
    return databaseClient.sql("""
            select *
            from sql_workbench_connection
            order by connection_id asc
            """)
        .map((row, metadata) -> mapConnection(row))
        .all()
        .collectList()
        .block();
  }

  @Override
  public Optional<SqlConnectionSummary> find(String connectionId) {
    return databaseClient.sql("""
            select *
            from sql_workbench_connection
            where connection_id = :connectionId
            """)
        .bind("connectionId", connectionId)
        .map((row, metadata) -> mapConnection(row))
        .one()
        .blockOptional();
  }

  @Override
  public SqlConnectionSummary create(SqlConnectionCreateRequest request) {
    String connectionId = uniqueConnectionId(request.displayName());
    SqlConnectionSummary summary = new SqlConnectionSummary(
        "1.0",
        connectionId,
        request.displayName(),
        request.targetEnvironment(),
        request.platformType(),
        request.host(),
        request.port(),
        request.defaultSchema(),
        request.allowedSchemas(),
        request.capabilities(),
        request.credentialAlias(),
        "PENDING_WORKER_BINDING",
        request.maxRowsDefault(),
        request.timeoutSecondsDefault());
    insert(summary);
    return find(connectionId).orElseThrow();
  }

  @Override
  public SqlConnectionSummary update(String connectionId, SqlConnectionUpdateRequest request) {
    if (find(connectionId).isEmpty()) {
      throw new IllegalArgumentException("SQL connection is not available");
    }
    SqlConnectionSummary summary = new SqlConnectionSummary(
        "1.0",
        connectionId,
        request.displayName(),
        request.targetEnvironment(),
        request.platformType(),
        request.host(),
        request.port(),
        request.defaultSchema(),
        request.allowedSchemas(),
        request.capabilities(),
        request.credentialAlias(),
        "PENDING_WORKER_BINDING",
        request.maxRowsDefault(),
        request.timeoutSecondsDefault());
    updateRow(summary);
    return find(connectionId).orElseThrow();
  }

  @Override
  public void delete(String connectionId) {
    long rowsUpdated = databaseClient.sql("""
            delete from sql_workbench_connection
            where connection_id = :connectionId
            """)
        .bind("connectionId", connectionId)
        .fetch()
        .rowsUpdated()
        .block();
    if (rowsUpdated == 0) {
      throw new IllegalArgumentException("SQL connection is not available");
    }
  }

  @Override
  public SqlConnectionSummary updateStatus(String connectionId, String status) {
    SqlConnectionSummary current = find(connectionId)
        .orElseThrow(() -> new IllegalArgumentException("SQL connection is not available"));
    SqlConnectionSummary updated = new SqlConnectionSummary(
        current.contractVersion(),
        current.connectionId(),
        current.displayName(),
        current.targetEnvironment(),
        current.platformType(),
        current.host(),
        current.port(),
        current.defaultSchema(),
        current.allowedSchemas(),
        current.capabilities(),
        current.credentialAlias(),
        status,
        current.maxRowsDefault(),
        current.timeoutSecondsDefault());
    updateRow(updated);
    return find(connectionId).orElseThrow();
  }

  private void insert(SqlConnectionSummary connection) {
    bindConnection(databaseClient.sql("""
            insert into sql_workbench_connection (
              connection_id,
              display_name,
              target_environment,
              platform_type,
              host,
              port,
              default_schema,
              allowed_schemas,
              capabilities,
              credential_alias,
              status,
              max_rows_default,
              timeout_seconds_default
            ) values (
              :connectionId,
              :displayName,
              :targetEnvironment,
              :platformType,
              :host,
              :port,
              :defaultSchema,
              :allowedSchemas,
              :capabilities,
              :credentialAlias,
              :status,
              :maxRowsDefault,
              :timeoutSecondsDefault
            )
            """), connection)
        .fetch()
        .rowsUpdated()
        .block();
  }

  private void updateRow(SqlConnectionSummary connection) {
    bindConnection(databaseClient.sql("""
            update sql_workbench_connection
            set display_name = :displayName,
                target_environment = :targetEnvironment,
                platform_type = :platformType,
                host = :host,
                port = :port,
                default_schema = :defaultSchema,
                allowed_schemas = :allowedSchemas,
                capabilities = :capabilities,
                credential_alias = :credentialAlias,
                status = :status,
                max_rows_default = :maxRowsDefault,
                timeout_seconds_default = :timeoutSecondsDefault
            where connection_id = :connectionId
            """), connection)
        .fetch()
        .rowsUpdated()
        .block();
  }

  private DatabaseClient.GenericExecuteSpec bindConnection(
      DatabaseClient.GenericExecuteSpec spec,
      SqlConnectionSummary connection) {
    return spec
        .bind("connectionId", connection.connectionId())
        .bind("displayName", connection.displayName())
        .bind("targetEnvironment", connection.targetEnvironment())
        .bind("platformType", connection.platformType())
        .bind("host", connection.host())
        .bind("port", connection.port())
        .bind("defaultSchema", connection.defaultSchema())
        .bind("allowedSchemas", writeJson(connection.allowedSchemas()))
        .bind("capabilities", writeJson(connection.capabilities()))
        .bind("credentialAlias", connection.credentialAlias())
        .bind("status", connection.status())
        .bind("maxRowsDefault", connection.maxRowsDefault())
        .bind("timeoutSecondsDefault", connection.timeoutSecondsDefault());
  }

  private SqlConnectionSummary mapConnection(io.r2dbc.spi.Row row) {
    return new SqlConnectionSummary(
        "1.0",
        row.get("connection_id", String.class),
        row.get("display_name", String.class),
        row.get("target_environment", String.class),
        row.get("platform_type", String.class),
        row.get("host", String.class),
        number(row.get("port")).intValue(),
        row.get("default_schema", String.class),
        readJson(row.get("allowed_schemas", String.class), STRING_LIST),
        readJson(row.get("capabilities", String.class), ACTION_LIST),
        row.get("credential_alias", String.class),
        row.get("status", String.class),
        number(row.get("max_rows_default")).intValue(),
        number(row.get("timeout_seconds_default")).intValue());
  }

  private String uniqueConnectionId(String displayName) {
    String base = NON_ALPHANUMERIC.matcher(displayName.toLowerCase()).replaceAll("-")
        .replaceAll("^-|-$", "");
    if (base.isBlank()) {
      base = "sql-connection";
    }
    String candidate = base;
    int suffix = 2;
    while (find(candidate).isPresent()) {
      candidate = base + "-" + suffix;
      suffix++;
    }
    return candidate;
  }

  private String writeJson(Object value) {
    try {
      return objectMapper.writeValueAsString(value);
    } catch (JsonProcessingException exception) {
      throw new IllegalArgumentException("SQL connection metadata must be serializable", exception);
    }
  }

  private <T> T readJson(String value, TypeReference<T> type) {
    try {
      return objectMapper.readValue(value, type);
    } catch (JsonProcessingException exception) {
      throw new IllegalArgumentException("SQL connection metadata is not valid JSON", exception);
    }
  }

  private Number number(Object value) {
    if (value instanceof Number number) {
      return number;
    }
    return Mono.justOrEmpty(value)
        .map(Object::toString)
        .map(Long::parseLong)
        .blockOptional()
        .orElseThrow(() -> new IllegalArgumentException("numeric value is missing"));
  }
}
