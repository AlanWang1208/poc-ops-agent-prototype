package com.company.opsagent.controlplane.modules.sqlworkbench;

import com.company.opsagent.contracts.sqlworkbench.SqlConnectionCreateRequest;
import com.company.opsagent.contracts.sqlworkbench.SqlConnectionProbeResult;
import com.company.opsagent.contracts.sqlworkbench.SqlConnectionSummary;
import com.company.opsagent.contracts.sqlworkbench.SqlAssistantRequest;
import com.company.opsagent.contracts.sqlworkbench.SqlAssistantResponse;
import com.company.opsagent.contracts.sqlworkbench.SqlAssistantStatus;
import com.company.opsagent.contracts.sqlworkbench.SqlQueryAction;
import com.company.opsagent.contracts.sqlworkbench.SqlQueryExecutionRequest;
import com.company.opsagent.contracts.sqlworkbench.SqlQueryExecutionResult;
import com.company.opsagent.contracts.sqlworkbench.SqlQueryRequest;
import com.company.opsagent.contracts.sqlworkbench.SqlResultPage;
import com.company.opsagent.contracts.sqlworkbench.SqlValidationLevel;
import com.company.opsagent.contracts.sqlworkbench.SqlValidationReport;
import com.company.opsagent.contracts.workflow.OperatorContext;
import com.company.opsagent.contracts.workflow.PolicyDecisionReference;
import com.company.opsagent.contracts.workflow.TraceContext;
import java.time.Clock;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

/**
 * SQL 工作台应用服务，先校验连接目录边界，再委托 AST 校验。
 */
public class DefaultSqlWorkbenchService implements SqlWorkbenchService {

  private final SqlConnectionCatalog connectionCatalog;
  private final SqlValidationService validationService;
  private final SqlWorkbenchWorkerClient workerClient;
  private final SqlAssistantClient assistantClient;
  private final Clock clock;

  public DefaultSqlWorkbenchService(
      SqlConnectionCatalog connectionCatalog,
      SqlValidationService validationService) {
    this(
        connectionCatalog,
        validationService,
        new FailClosedSqlWorkbenchWorkerClient(),
        new FailClosedSqlAssistantClient(),
        Clock.systemUTC());
  }

  public DefaultSqlWorkbenchService(
      SqlConnectionCatalog connectionCatalog,
      SqlValidationService validationService,
      SqlWorkbenchWorkerClient workerClient,
      Clock clock) {
    this(
        connectionCatalog,
        validationService,
        workerClient,
        new FailClosedSqlAssistantClient(),
        clock);
  }

  public DefaultSqlWorkbenchService(
      SqlConnectionCatalog connectionCatalog,
      SqlValidationService validationService,
      SqlWorkbenchWorkerClient workerClient,
      SqlAssistantClient assistantClient,
      Clock clock) {
    this.connectionCatalog = connectionCatalog;
    this.validationService = validationService;
    this.workerClient = workerClient;
    this.assistantClient = assistantClient;
    this.clock = clock;
  }

  @Override
  public List<SqlConnectionSummary> listConnections() {
    return connectionCatalog.list();
  }

  @Override
  public SqlConnectionSummary createConnection(SqlConnectionCreateRequest request) {
    SqlConnectionSummary created = connectionCatalog.create(request);
    try {
      SqlConnectionProbeResult probe = workerClient.probe(created);
      if ("READY".equalsIgnoreCase(probe.status())) {
        return connectionCatalog.updateStatus(created.connectionId(), "READY");
      }
    } catch (RuntimeException ignored) {
      // New connections remain pending until the worker binding can be verified.
    }
    return created;
  }

  @Override
  public SqlConnectionProbeResult probeConnection(String connectionId) {
    SqlConnectionSummary connection = connectionCatalog.find(connectionId)
        .orElseThrow(() -> new IllegalArgumentException("SQL connection is not available"));
    return workerClient.probe(connection);
  }

  @Override
  public SqlValidationReport validate(SqlQueryRequest request) {
    SqlConnectionSummary connection = connectionCatalog.find(request.connectionId())
        .orElseThrow(() -> new IllegalArgumentException("SQL connection is not available"));
    if (!connection.targetEnvironment().equalsIgnoreCase(request.targetEnvironment())) {
      throw new IllegalArgumentException("target environment does not match connection");
    }
    boolean schemaAllowed = connection.allowedSchemas().stream()
        .anyMatch(schema -> schema.equalsIgnoreCase(request.schema()));
    if (!schemaAllowed) {
      throw new IllegalArgumentException("schema is not allowed for connection");
    }
    if (!connection.capabilities().contains(request.action())) {
      throw new IllegalArgumentException("action is not allowed for connection");
    }
    SqlValidationReport report = validationService.validate(request);
    boolean crossSchemaReference = report.referencedObjects().stream()
        .filter(object -> object.contains("."))
        .map(object -> object.substring(0, object.indexOf('.')))
        .anyMatch(referencedSchema -> connection.allowedSchemas().stream()
            .noneMatch(allowed -> allowed.equalsIgnoreCase(referencedSchema)));
    if (crossSchemaReference) {
      throw new IllegalArgumentException("SQL references a schema outside the connection allow list");
    }
    return report;
  }

  @Override
  public SqlAssistantResponse assist(SqlAssistantRequest request) {
    SqlConnectionSummary connection = connectionCatalog.find(request.connectionId())
        .orElseThrow(() -> new IllegalArgumentException("SQL connection is not available"));
    SqlQueryRequest validationRequest = new SqlQueryRequest(
        "1.0",
        request.connectionId(),
        request.targetEnvironment(),
        request.schema(),
        SqlQueryAction.VALIDATE,
        request.sql(),
        List.of(),
        request.limits(),
        request.idempotencyKey());
    SqlValidationReport report = validate(validationRequest);
    return assistantClient.ask(new SqlAssistantPrompt(
        request.assistantAction(),
        connection.connectionId(),
        connection.targetEnvironment(),
        request.schema(),
        connection.platformType(),
        request.sql(),
        report,
        request.diagnosticContext()));
  }

  @Override
  public SqlQueryExecutionResult runReadOnlyQuery(
      SqlQueryRequest request,
      OperatorContext operator,
      PolicyDecisionReference policyDecision,
      TraceContext trace) {
    if (request.action() != SqlQueryAction.RUN_READ_ONLY) {
      throw new IllegalArgumentException("queries/run only accepts RUN_READ_ONLY");
    }
    SqlValidationReport report = validate(request);
    if (report.validationLevel() != SqlValidationLevel.VALIDATED) {
      throw new IllegalArgumentException("query must pass read-only validation before execution");
    }
    SqlQueryExecutionRequest executionRequest = new SqlQueryExecutionRequest(
        "1.0",
        UUID.randomUUID().toString(),
        UUID.randomUUID().toString(),
        request,
        report.sqlHash(),
        operator,
        policyDecision,
        trace,
        OffsetDateTime.now(clock).plusSeconds(request.limits().timeoutSeconds()));
    return workerClient.execute(executionRequest);
  }

  @Override
  public SqlResultPage readResultPage(String resultId) {
    return workerClient.readResultPage(resultId);
  }

  private static final class FailClosedSqlWorkbenchWorkerClient implements SqlWorkbenchWorkerClient {

    @Override
    public SqlConnectionProbeResult probe(SqlConnectionSummary connection) {
      return new SqlConnectionProbeResult(
          "1.0",
          connection.connectionId(),
          "PROBE_FAILED",
          "SQL workbench worker client is not configured",
          OffsetDateTime.now());
    }

    @Override
    public SqlQueryExecutionResult execute(SqlQueryExecutionRequest request) {
      return new SqlQueryExecutionResult(
          "1.0",
          request.executionRequestId(),
          request.workflowId(),
          "FAILED",
          null,
          "SQL_WORKER_NOT_CONFIGURED",
          "SQL workbench worker client is not configured");
    }

    @Override
    public SqlResultPage readResultPage(String resultId) {
      throw new IllegalStateException("SQL workbench worker client is not configured");
    }
  }

  private static final class FailClosedSqlAssistantClient implements SqlAssistantClient {

    @Override
    public SqlAssistantResponse ask(SqlAssistantPrompt prompt) {
      return new SqlAssistantResponse(
          "1.0",
          SqlAssistantStatus.MODEL_NOT_CONFIGURED,
          prompt.assistantAction(),
          "SQL assistant model provider is not configured.",
          List.of(),
          List.of("AI SQL assistant is advisory only and cannot execute SQL."),
          true,
          null);
    }
  }
}
