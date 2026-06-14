package com.company.opsagent.controlplane.bootstrap;

import static org.springframework.http.MediaType.APPLICATION_JSON;

import com.company.opsagent.contracts.events.SemanticEvent;
import com.company.opsagent.contracts.events.SemanticEventType;
import com.company.opsagent.contracts.events.SkillRoutedPayload;
import com.company.opsagent.contracts.events.WorkflowStartedPayload;
import com.company.opsagent.contracts.workflow.OperatorContext;
import com.company.opsagent.contracts.workflow.PolicyDecisionReference;
import com.company.opsagent.contracts.workflow.ReadOnlyCommandEnvelope;
import com.company.opsagent.contracts.workflow.SkillReference;
import com.company.opsagent.contracts.workflow.TraceContext;
import com.company.opsagent.controlplane.modules.skillregistry.SkillPublicationStatus;
import com.company.opsagent.controlplane.modules.audit.AuditEvent;
import com.company.opsagent.controlplane.modules.audit.AuditTrail;
import com.company.opsagent.controlplane.modules.workflow.ReadOnlyWorkflowRecoveryService;
import com.company.opsagent.controlplane.modules.workflow.ReadOnlyWorkflowStore;
import com.nimbusds.jose.JOSEException;
import com.nimbusds.jose.JWSAlgorithm;
import com.nimbusds.jose.JWSHeader;
import com.nimbusds.jose.crypto.MACSigner;
import com.nimbusds.jwt.JWTClaimsSet;
import com.nimbusds.jwt.SignedJWT;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.util.Date;
import java.util.List;
import org.junit.jupiter.api.Assertions;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.reactive.AutoConfigureWebTestClient;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.reactive.server.WebTestClient;

/**
 * 控制面应用集成测试。
 *
 * <p>使用开发态共享密钥模式覆盖内部接口、异常映射、权限控制、审计持久化和
 * Skill 注册中心查询等基础行为。
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@AutoConfigureWebTestClient
@TestPropertySource(properties = {
    "ops-agent.security.auth-mode=dev-hs256",
    "ops-agent.security.shared-secret=ops-agent-dev-secret-2026-06-06-0001",
    "ops-agent.security.issuer=ops-agent-dev",
    "ops-agent.security.audience=ops-agent-internal",
    "ops-agent.security.username-claim=preferred_username",
    "ops-agent.security.role-claim=roles",
    "ops-agent.policy.version=rbac-v1",
    "ops-agent.policy.required-roles-by-action.internal.health.read[0]=ROLE_ops-reader",
    "ops-agent.policy.required-roles-by-action.internal.health.read[1]=ROLE_ops-admin",
    "ops-agent.policy.required-roles-by-action.internal.modules.read[0]=ROLE_ops-reader",
    "ops-agent.policy.required-roles-by-action.internal.modules.read[1]=ROLE_ops-admin",
    "ops-agent.policy.required-roles-by-action.internal.echo.read[0]=ROLE_ops-reader",
    "ops-agent.policy.required-roles-by-action.internal.echo.read[1]=ROLE_ops-admin",
    "ops-agent.policy.required-roles-by-action.internal.failures.read[0]=ROLE_ops-admin",
    "ops-agent.policy.required-roles-by-action.internal.audit.read[0]=ROLE_ops-admin",
    "ops-agent.policy.required-roles-by-action.internal.audit.read[1]=ROLE_ops-auditor",
    "ops-agent.policy.required-roles-by-action.internal.skills.read[0]=ROLE_ops-reader",
    "ops-agent.policy.required-roles-by-action.internal.skills.read[1]=ROLE_ops-admin",
    "ops-agent.policy.required-roles-by-action.internal.skills.publish.validate[0]=ROLE_ops-admin",
    "ops-agent.policy.required-roles-by-action.internal.routing.skills.read[0]=ROLE_ops-reader",
    "ops-agent.policy.required-roles-by-action.internal.routing.skills.read[1]=ROLE_ops-admin",
    "ops-agent.policy.required-roles-by-action.internal.agent.diagnostics.read[0]=ROLE_ops-reader",
    "ops-agent.policy.required-roles-by-action.internal.agent.diagnostics.read[1]=ROLE_ops-admin",
    "ops-agent.skill-registry.root-path=target/test-classes/skills",
    "ops-agent.skill-registry.signature-required=true",
    "ops-agent.skill-registry.signing-secret=ops-agent-skill-signing-key-2026-06-06-0001",
    "ops-agent.audit.storage-path=target/test-audit/control-plane-audit.jsonl",
    "spring.r2dbc.url=r2dbc:h2:mem:///control-plane-test;MODE=PostgreSQL;DB_CLOSE_DELAY=-1",
    "ops-agent.workflow.startup-recovery-enabled=false"
})
class ControlPlaneApplicationTest {

  private static final String SECRET = "ops-agent-dev-secret-2026-06-06-0001";
  private static final Path AUDIT_PATH = Path.of("target/test-audit/control-plane-audit.jsonl");

  @Autowired
  private WebTestClient webTestClient;

  @Autowired
  private AuditTrail auditTrail;

  @Autowired
  private ReadOnlyWorkflowStore readOnlyWorkflowStore;

  @Autowired
  private ReadOnlyWorkflowRecoveryService readOnlyWorkflowRecoveryService;

  @Test
  void exposesInternalHealthEndpoint() {
    auditTrail.clear();
    webTestClient.get()
        .uri("/internal/healthz")
        .headers(headers -> headers.setBearerAuth(token("alice", List.of("ops-reader"), "ops-agent-internal")))
        .exchange()
        .expectStatus().isOk()
        .expectHeader().contentTypeCompatibleWith(APPLICATION_JSON)
        .expectBody()
        .jsonPath("$.status").isEqualTo("UP")
        .jsonPath("$.service").isEqualTo("control-plane")
        .jsonPath("$.version").isEqualTo("0.1.0-SNAPSHOT")
        .jsonPath("$.modules.length()").isEqualTo(8);
  }

  @Test
  void exposesModuleManifestEndpoint() {
    auditTrail.clear();
    webTestClient.get()
        .uri("/internal/modules")
        .headers(headers -> headers.setBearerAuth(token("alice", List.of("ops-reader"), "ops-agent-internal")))
        .exchange()
        .expectStatus().isOk()
        .expectBody()
        .jsonPath("$.service").isEqualTo("control-plane")
        .jsonPath("$.version").isEqualTo("0.1.0-SNAPSHOT")
        .jsonPath("$.moduleIds[0]").isEqualTo("M01")
        .jsonPath("$.moduleIds[7]").isEqualTo("M09");
  }

  @Test
  void exposesOpenApiDocument() {
    webTestClient.get()
        .uri("/v3/api-docs")
        .exchange()
        .expectStatus().isOk()
        .expectBody()
        .jsonPath("$.info.title").isEqualTo("Ops Agent Control Plane API")
        .jsonPath("$.info.version").isEqualTo("0.1.0-SNAPSHOT");
  }

  @Test
  void returnsStructuredBadRequestForIllegalArgument() {
    auditTrail.clear();
    webTestClient.get()
        .uri("/internal/failures/illegal-argument")
        .headers(headers -> headers.setBearerAuth(token("admin", List.of("ops-admin"), "ops-agent-internal")))
        .exchange()
        .expectStatus().isBadRequest()
        .expectBody()
        .jsonPath("$.code").isEqualTo("INVALID_ARGUMENT")
        .jsonPath("$.path").isEqualTo("/internal/failures/illegal-argument");
  }

  @Test
  void returnsStructuredBadRequestForValidationFailure() {
    auditTrail.clear();
    webTestClient.get()
        .uri("/internal/echo?value=")
        .headers(headers -> headers.setBearerAuth(token("alice", List.of("ops-reader"), "ops-agent-internal")))
        .exchange()
        .expectStatus().isBadRequest()
        .expectBody()
        .jsonPath("$.code").isEqualTo("VALIDATION_ERROR");
  }

  @Test
  void rejectsMissingTokenOnInternalEndpoint() {
    auditTrail.clear();
    webTestClient.get()
        .uri("/internal/healthz")
        .exchange()
        .expectStatus().isUnauthorized()
        .expectBody()
        .jsonPath("$.code").isEqualTo("UNAUTHENTICATED");
  }

  @Test
  void rejectsTokenWithInvalidAudience() {
    auditTrail.clear();
    webTestClient.get()
        .uri("/internal/healthz")
        .headers(headers -> headers.setBearerAuth(token("alice", List.of("ops-reader"), "wrong-audience")))
        .exchange()
        .expectStatus().isUnauthorized()
        .expectBody()
        .jsonPath("$.code").isEqualTo("UNAUTHENTICATED");
  }

  @Test
  void rejectsReaderFromAdminOnlyEndpoint() {
    auditTrail.clear();
    webTestClient.get()
        .uri("/internal/failures/illegal-argument")
        .headers(headers -> headers.setBearerAuth(token("alice", List.of("ops-reader"), "ops-agent-internal")))
        .exchange()
        .expectStatus().isForbidden()
        .expectBody()
        .jsonPath("$.code").isEqualTo("POLICY_DENIED");
  }

  @Test
  void recordsAuditTrailForAuthorizedRequest() {
    auditTrail.clear();
    webTestClient.get()
        .uri("/internal/healthz")
        .header("X-Trace-Id", "trace-123")
        .headers(headers -> headers.setBearerAuth(token("alice", List.of("ops-reader"), "ops-agent-internal")))
        .exchange()
        .expectStatus().isOk();

    AuditEvent event = auditTrail.latest().orElseThrow();
    Assertions.assertEquals("alice", event.subject());
    Assertions.assertEquals("internal.health.read", event.action());
    Assertions.assertEquals("/internal/healthz", event.resource());
    Assertions.assertEquals("rbac-v1", event.policyVersion());
    Assertions.assertEquals("ALLOW", event.result());
    Assertions.assertEquals("trace-123", event.traceId());
    Assertions.assertTrue(Files.exists(AUDIT_PATH));
  }

  @Test
  void exposesLatestAuditEventForAdmin() {
    auditTrail.clear();
    webTestClient.get()
        .uri("/internal/healthz")
        .headers(headers -> headers.setBearerAuth(token("alice", List.of("ops-reader"), "ops-agent-internal")))
        .exchange()
        .expectStatus().isOk();

    webTestClient.get()
        .uri("/internal/audit/latest")
        .headers(headers -> headers.setBearerAuth(token("auditor", List.of("ops-auditor"), "ops-agent-internal")))
        .exchange()
        .expectStatus().isOk()
        .expectBody()
        .jsonPath("$.count").isNumber()
        .jsonPath("$.latest.subject").isEqualTo("auditor")
        .jsonPath("$.latest.action").isEqualTo("internal.audit.read");
  }

  @Test
  void exposesRegisteredSkillCatalog() {
    auditTrail.clear();
    webTestClient.get()
        .uri("/internal/skills")
        .headers(headers -> headers.setBearerAuth(token("alice", List.of("ops-reader"), "ops-agent-internal")))
        .exchange()
        .expectStatus().isOk()
        .expectBody()
        .jsonPath("$.total").isEqualTo(2)
        .jsonPath("$.skills[0].descriptor.skillId").isEqualTo("application-log-summary-read")
        .jsonPath("$.skills[0].publication.signatureAlgorithm").isEqualTo("HmacSHA256")
        .jsonPath("$.skills[1].descriptor.skillId").isEqualTo("node-health-read")
        .jsonPath("$.skills[1].publication.publishedBy").isEqualTo("platform-observability");
  }

  @Test
  void exposesLatestRegisteredSkillBySkillId() {
    auditTrail.clear();
    webTestClient.get()
        .uri("/internal/skills/node-health-read")
        .headers(headers -> headers.setBearerAuth(token("alice", List.of("ops-reader"), "ops-agent-internal")))
        .exchange()
        .expectStatus().isOk()
        .expectBody()
        .jsonPath("$.skill.descriptor.skillId").isEqualTo("node-health-read")
        .jsonPath("$.skill.descriptor.version").isEqualTo("1.1.0")
        .jsonPath("$.skill.descriptor.readOnly").isEqualTo(true)
        .jsonPath("$.skill.publication.signatureAlgorithm").isEqualTo("HmacSHA256");
  }

  @Test
  void rejectsSkillCatalogRequestWithoutReaderRole() {
    auditTrail.clear();
    webTestClient.get()
        .uri("/internal/skills")
        .headers(headers -> headers.setBearerAuth(token("guest", List.of("ops-auditor"), "ops-agent-internal")))
        .exchange()
        .expectStatus().isForbidden()
        .expectBody()
        .jsonPath("$.code").isEqualTo("POLICY_DENIED");
  }

  @Test
  void validatesSkillPublicationThroughExplicitAction() {
    auditTrail.clear();
    webTestClient.post()
        .uri("/internal/skills/publications/validate")
        .headers(headers -> headers.setBearerAuth(token("admin", List.of("ops-admin"), "ops-agent-internal")))
        .contentType(APPLICATION_JSON)
        .bodyValue("""
            {
              "manifestPath": "node-health/manifest.json"
            }
            """)
        .exchange()
        .expectStatus().isOk()
        .expectBody()
        .jsonPath("$.result.passed").isEqualTo(true)
        .jsonPath("$.result.registeredSkill.descriptor.skillId").isEqualTo("node-health-read")
        .jsonPath("$.result.registeredSkill.publicationStatus").isEqualTo("VALIDATED");
  }

  @Test
  void searchesSkillRoutingCandidatesByRouteCriteria() {
    auditTrail.clear();
    webTestClient.post()
        .uri("/internal/routing/skills/search")
        .headers(headers -> headers.setBearerAuth(token("alice", List.of("ops-reader"), "ops-agent-internal")))
        .contentType(APPLICATION_JSON)
        .bodyValue("""
            {
              "category": "APPLICATION_DIAGNOSTICS",
              "maxRiskLevel": "READ_ONLY",
              "requiredParameters": ["applicationName"],
              "requiredTags": ["summary"],
              "publicationStatusRequired": "VALIDATED"
            }
            """)
        .exchange()
        .expectStatus().isOk()
        .expectBody()
        .jsonPath("$.total").isEqualTo(1)
        .jsonPath("$.candidates[0].skill.descriptor.skillId").isEqualTo("application-log-summary-read")
        .jsonPath("$.candidates[0].skill.publicationStatus").isEqualTo("VALIDATED");
  }

  @Test
  void rejectsMissingTokenOnAgentDiagnosticEndpoint() {
    auditTrail.clear();
    webTestClient.post()
        .uri("/api/v1/agent/diagnostics")
        .contentType(APPLICATION_JSON)
        .bodyValue(agentDiagnosticBody("agent-missing-token"))
        .exchange()
        .expectStatus().isUnauthorized()
        .expectBody()
        .jsonPath("$.code").isEqualTo("UNAUTHENTICATED");
  }

  @Test
  void rejectsAgentDiagnosticEndpointWithoutReaderRole() {
    auditTrail.clear();
    webTestClient.post()
        .uri("/api/v1/agent/diagnostics")
        .headers(headers -> headers.setBearerAuth(token("auditor", List.of("ops-auditor"), "ops-agent-internal")))
        .contentType(APPLICATION_JSON)
        .bodyValue(agentDiagnosticBody("agent-denied"))
        .exchange()
        .expectStatus().isForbidden()
        .expectBody()
        .jsonPath("$.code").isEqualTo("POLICY_DENIED");
  }

  @Test
  void reportsAgentRuntimeDisabledUntilExplicitlyEnabled() {
    auditTrail.clear();
    webTestClient.post()
        .uri("/api/v1/agent/diagnostics")
        .headers(headers -> headers.setBearerAuth(token("alice", List.of("ops-reader"), "ops-agent-internal")))
        .contentType(APPLICATION_JSON)
        .bodyValue(agentDiagnosticBody("agent-disabled"))
        .exchange()
        .expectStatus().isEqualTo(503)
        .expectBody()
        .jsonPath("$.code").isEqualTo("AGENT_RUNTIME_DISABLED");
  }

  @Test
  void wiresWorkflowPersistenceStoreAndRecoveryService() {
    Assertions.assertNotNull(readOnlyWorkflowStore);
    Assertions.assertNotNull(readOnlyWorkflowRecoveryService);

    var now = OffsetDateTime.parse("2026-06-07T01:00:00Z");
    var command = new ReadOnlyCommandEnvelope(
        "1.0",
        "command-bootstrap-1",
        "workflow-bootstrap-1",
        "idempotency-bootstrap-1",
        "READ_ONLY",
        "development",
        new SkillReference(
            "node-health-read",
            "1.1.0",
            "node-health-read:1.1.0:input",
            "node-health-read:1.1.0:output"),
        new ObjectMapper().createObjectNode().put("nodeName", "node-a"),
        new OperatorContext("operator-1", List.of("ROLE_ops-reader")),
        new PolicyDecisionReference("decision-1", "policy-v1", "ALLOW"),
        new TraceContext("trace-1", "request-1"),
        now);

    reactor.test.StepVerifier.create(readOnlyWorkflowStore.createWorkflow(
            "workflow-bootstrap-1",
            "idempotency-bootstrap-1",
            "operator-1",
            "development",
            "node-health-read",
            "1.1.0",
            "sha256:test",
            "decision-1",
            "policy-v1",
            "trace-1",
            "request-1",
            "command-bootstrap-1",
            command,
            now)
        .then(readOnlyWorkflowStore.findByIdempotency(
            "idempotency-bootstrap-1",
            "operator-1",
            "development",
            "node-health-read",
            "sha256:test")))
        .assertNext(view -> Assertions.assertEquals("workflow-bootstrap-1", view.workflow().workflowId()))
        .verifyComplete();
  }

  @Test
  void streamsPersistedEventsAfterSequence() {
    var now = OffsetDateTime.parse("2026-06-07T02:00:00Z");
    var command = new ReadOnlyCommandEnvelope(
        "1.0",
        "command-stream-1",
        "workflow-stream-1",
        "idempotency-stream-1",
        "READ_ONLY",
        "development",
        new SkillReference(
            "node-health-read",
            "1.1.0",
            "node-health-read:1.1.0:input",
            "node-health-read:1.1.0:output"),
        new ObjectMapper().createObjectNode().put("nodeName", "node-a"),
        new OperatorContext("operator-1", List.of("ROLE_ops-reader")),
        new PolicyDecisionReference("decision-1", "policy-v1", "ALLOW"),
        new TraceContext("trace-1", "request-1"),
        now);

    reactor.test.StepVerifier.create(readOnlyWorkflowStore.createWorkflow(
            "workflow-stream-1",
            "idempotency-stream-1",
            "operator-1",
            "development",
            "node-health-read",
            "1.1.0",
            "sha256:stream",
            "decision-1",
            "policy-v1",
            "trace-1",
            "request-1",
            "command-stream-1",
            command,
            now)
        .then(readOnlyWorkflowStore.appendEvent("workflow-stream-1", 1, new SemanticEvent(
            "1.0",
            "stream-event-1",
            "workflow-stream-1",
            1,
            now,
            SemanticEventType.WORKFLOW_STARTED,
            new WorkflowStartedPayload(SemanticEventType.WORKFLOW_STARTED, "command-stream-1", "operator-1"))))
        .then(readOnlyWorkflowStore.appendEvent("workflow-stream-1", 2, new SemanticEvent(
            "1.0",
            "stream-event-2",
            "workflow-stream-1",
            2,
            now.plusSeconds(1),
            SemanticEventType.SKILL_ROUTED,
            new SkillRoutedPayload(SemanticEventType.SKILL_ROUTED, "node-health-read", "1.1.0")))))
        .verifyComplete();

    webTestClient.get()
        .uri("/internal/diagnostics/read-only/workflows/workflow-stream-1/events?afterSequence=1")
        .headers(headers -> headers.setBearerAuth(token("alice", List.of("ops-reader"), "ops-agent-internal")))
        .exchange()
        .expectStatus().isOk()
        .expectHeader().contentTypeCompatibleWith(org.springframework.http.MediaType.TEXT_EVENT_STREAM)
        .expectBody(String.class)
        .value(body -> {
          Assertions.assertTrue(body.contains("event:SKILL_ROUTED"));
          Assertions.assertFalse(body.contains("event:WORKFLOW_STARTED"));
        });
  }

  private String token(String username, List<String> roles, String audience) {
    try {
      JWTClaimsSet claimsSet = new JWTClaimsSet.Builder()
          .subject(username)
          .issuer("ops-agent-dev")
          .audience(audience)
          .issueTime(Date.from(Instant.now()))
          .expirationTime(Date.from(Instant.now().plusSeconds(600)))
          .claim("preferred_username", username)
          .claim("roles", roles)
          .build();
      SignedJWT signedJwt = new SignedJWT(new JWSHeader(JWSAlgorithm.HS256), claimsSet);
      signedJwt.sign(new MACSigner(SECRET.getBytes(StandardCharsets.UTF_8)));
      return signedJwt.serialize();
    } catch (JOSEException exception) {
      throw new IllegalStateException("failed to create test token", exception);
    }
  }

  private String agentDiagnosticBody(String idempotencyKey) {
    return """
        {
          "targetEnvironment": "development",
          "idempotencyKey": "%s",
          "userIntent": "check node health",
          "inputParameters": {
            "nodeId": "node-1"
          }
        }
        """.formatted(idempotencyKey);
  }
}
