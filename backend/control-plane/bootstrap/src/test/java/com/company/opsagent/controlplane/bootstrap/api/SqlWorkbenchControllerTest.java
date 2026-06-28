package com.company.opsagent.controlplane.bootstrap.api;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertInstanceOf;

import com.company.opsagent.contracts.sqlworkbench.SqlConnectionCreateRequest;
import com.company.opsagent.contracts.sqlworkbench.SqlConnectionProbeResult;
import com.company.opsagent.contracts.sqlworkbench.SqlConnectionSummary;
import com.company.opsagent.contracts.sqlworkbench.SqlAssistantAction;
import com.company.opsagent.contracts.sqlworkbench.SqlAssistantRequest;
import com.company.opsagent.contracts.sqlworkbench.SqlAssistantResponse;
import com.company.opsagent.contracts.sqlworkbench.SqlAssistantStatus;
import com.company.opsagent.contracts.sqlworkbench.SqlAssistantSuggestion;
import com.company.opsagent.contracts.sqlworkbench.SqlQueryExecutionResult;
import com.company.opsagent.contracts.sqlworkbench.SqlQueryRequest;
import com.company.opsagent.contracts.sqlworkbench.SqlResultPage;
import com.company.opsagent.contracts.sqlworkbench.SqlValidationReport;
import com.company.opsagent.contracts.workflow.OperatorContext;
import com.company.opsagent.contracts.workflow.PolicyDecisionReference;
import com.company.opsagent.contracts.workflow.TraceContext;
import com.company.opsagent.controlplane.modules.sqlworkbench.SqlWorkbenchService;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.List;
import java.util.concurrent.atomic.AtomicInteger;
import org.junit.jupiter.api.Test;
import reactor.test.StepVerifier;

/**
 * SQL 工作台控制器的 HTTP 载荷边界测试。
 */
class SqlWorkbenchControllerTest {

  private final RecordingSqlWorkbenchService service = new RecordingSqlWorkbenchService();
  private final SqlWorkbenchController controller = new SqlWorkbenchController(service, new ObjectMapper());
  private final ObjectMapper objectMapper = new ObjectMapper();

  @Test
  void rejectsUnknownConnectionCreateFieldsBeforeServiceLayer() throws Exception {
    var request = objectMapper.readTree("""
        {
          "contractVersion": "1.0",
          "displayName": "AS/400 Dev Sandbox",
          "targetEnvironment": "development",
          "platformType": "DB2_FOR_I",
          "host": "as400-dev.internal",
          "port": 446,
          "defaultSchema": "ORDERS",
          "allowedSchemas": ["ORDERS"],
          "capabilities": ["VALIDATE", "RUN_READ_ONLY"],
          "credentialAlias": "as400-dev-readonly",
          "maxRowsDefault": 500,
          "timeoutSecondsDefault": 30,
          "password": "must-not-be-accepted"
        }
        """);

    StepVerifier.create(controller.createConnection(request))
        .expectErrorSatisfies(error -> {
          assertInstanceOf(IllegalArgumentException.class, error);
          assertEquals("unsupported SQL connection create field: password", error.getMessage());
        })
        .verify();

    assertEquals(0, service.createCount.get());
  }

  @Test
  void passesSqlAssistantRequestThroughTypedServiceBoundary() throws Exception {
    var request = objectMapper.readTree("""
        {
          "contractVersion": "1.0",
          "connectionId": "as400-development",
          "targetEnvironment": "development",
          "schema": "ORDERS",
          "assistantAction": "ANALYZE_ERROR",
          "sql": "select * from ORDERS.ORDERS",
          "limits": {
            "maxRows": 500,
            "maxBytes": 5000000,
            "timeoutSeconds": 30
          },
          "diagnosticContext": "SQL syntax is not supported",
          "idempotencyKey": "assistant-key-1"
        }
        """);

    StepVerifier.create(controller.assist(request))
        .assertNext(response -> {
          assertEquals(SqlAssistantStatus.SUCCEEDED, response.status());
          assertEquals(SqlAssistantAction.ANALYZE_ERROR, response.assistantAction());
          assertEquals(true, response.validationRequired());
        })
        .verifyComplete();

    assertEquals(1, service.assistCount.get());
    assertEquals(SqlAssistantAction.ANALYZE_ERROR, service.lastAssistantRequest.assistantAction());
    assertEquals("SQL syntax is not supported", service.lastAssistantRequest.diagnosticContext());
  }

  private static final class RecordingSqlWorkbenchService implements SqlWorkbenchService {

    private final AtomicInteger createCount = new AtomicInteger();
    private final AtomicInteger assistCount = new AtomicInteger();
    private SqlAssistantRequest lastAssistantRequest;

    @Override
    public List<SqlConnectionSummary> listConnections() {
      throw new UnsupportedOperationException();
    }

    @Override
    public SqlConnectionSummary createConnection(SqlConnectionCreateRequest request) {
      createCount.incrementAndGet();
      throw new UnsupportedOperationException();
    }

    @Override
    public SqlConnectionProbeResult probeConnection(String connectionId) {
      throw new UnsupportedOperationException();
    }

    @Override
    public SqlValidationReport validate(SqlQueryRequest request) {
      throw new UnsupportedOperationException();
    }

    @Override
    public SqlAssistantResponse assist(SqlAssistantRequest request) {
      assistCount.incrementAndGet();
      lastAssistantRequest = request;
      return new SqlAssistantResponse(
          "1.0",
          SqlAssistantStatus.SUCCEEDED,
          request.assistantAction(),
          "The error points to SQL syntax.",
          List.of(new SqlAssistantSuggestion(
              "Check statement syntax",
              "The parser rejected the submitted SQL before execution.",
              null)),
          List.of("AI suggestions must be validated before execution."),
          true,
          "provider:fingerprint");
    }

    @Override
    public SqlQueryExecutionResult runReadOnlyQuery(
        SqlQueryRequest request,
        OperatorContext operator,
        PolicyDecisionReference policyDecision,
        TraceContext trace) {
      throw new UnsupportedOperationException();
    }

    @Override
    public SqlResultPage readResultPage(String resultId) {
      throw new UnsupportedOperationException();
    }
  }
}
