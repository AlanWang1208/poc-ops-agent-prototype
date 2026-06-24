package com.company.opsagent.controlplane.modules.agentruntime;

import static org.junit.jupiter.api.Assertions.assertEquals;

import io.agentscope.core.message.Msg;
import io.agentscope.core.model.ChatResponse;
import io.agentscope.core.model.GenerateOptions;
import io.agentscope.core.model.Model;
import io.agentscope.core.model.ToolSchema;
import java.time.Duration;
import java.util.List;
import java.util.Map;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.jupiter.api.Test;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;
import reactor.test.StepVerifier;

class AgentscopePrimaryAgentRuntimeServiceTest {

  @Test
  void runtimeOnlySeesPublishedReadOnlyToolCatalog() {
    var invocation = new AtomicReference<AgentscopeAgentInvocation>();
    AgentscopeAgentClient client = request -> {
      invocation.set(request);
      return Mono.just(new AgentscopeAgentResponse("SUCCEEDED", "node-1 is healthy", 1));
    };
    AgentToolExecutor toolExecutor = (runtimeRequest, toolCall) -> Mono.empty();
    var service = new AgentscopePrimaryAgentRuntimeService(
        () -> List.of(readOnlyTool(), writeTool()),
        client,
        toolExecutor);

    StepVerifier.create(service.run(runtimeRequest()))
        .assertNext(result -> {
          assertEquals("SUCCEEDED", result.status());
          assertEquals("node-1 is healthy", result.summary());
          assertEquals(1, result.toolCallCount());
        })
        .verifyComplete();

    assertEquals(List.of("node-health"), invocation.get().tools().stream()
        .map(AgentToolDescriptor::skillId)
        .toList());
    assertEquals(toolExecutor, invocation.get().toolExecutor());
  }

  @Test
  void mapsSanitizedCatalogToAgentscopeToolSchemas() {
    var schemas = AgentscopeToolSchemaFactory.fromCatalog(List.of(readOnlyTool()));

    assertEquals(1, schemas.size());
    assertEquals("node-health", schemas.getFirst().getName());
    assertEquals("Read-only node health check", schemas.getFirst().getDescription());
    assertEquals("object", schemas.getFirst().getParameters().get("type"));
    @SuppressWarnings("unchecked")
    Map<String, Object> properties = (Map<String, Object>) schemas.getFirst().getParameters().get("properties");
    assertEquals(Map.of("type", "string"), properties.get("nodeId"));
  }

  @Test
  void modelTimeoutReturnsControlledRuntimeFailure() {
    var client = new AgentscopeReActAgentClient(new NeverRespondingModel(), 1, Duration.ofMillis(10));
    AgentToolExecutor toolExecutor = (runtimeRequest, toolCall) -> Mono.error(
        new AssertionError("model timeout must not execute tools"));
    var service = new AgentscopePrimaryAgentRuntimeService(
        () -> List.of(readOnlyTool()),
        client,
        toolExecutor);

    StepVerifier.create(service.run(runtimeRequest()))
        .assertNext(result -> {
          assertEquals("AGENT_RUNTIME_FAILED", result.status());
          assertEquals("AgentScope runtime failed before producing a valid result.", result.summary());
          assertEquals(0, result.toolCallCount());
        })
        .verifyComplete();
  }

  private AgentRuntimeRequest runtimeRequest() {
    return new AgentRuntimeRequest(
        "task-1",
        "workflow-1",
        "workspace-default",
        "operator-1",
        List.of("ROLE_ops-reader"),
        "development",
        "check node-1 health",
        Map.of("nodeId", "node-1"),
        "trace-1",
        "request-1");
  }

  private AgentToolDescriptor readOnlyTool() {
    return new AgentToolDescriptor(
        "node-health",
        "1.0.0",
        "Read-only node health check",
        "node-health:1.0.0:input",
        "node-health:1.0.0:output",
        List.of("nodeId"),
        "READ_ONLY");
  }

  private AgentToolDescriptor writeTool() {
    return new AgentToolDescriptor(
        "restart-node",
        "1.0.0",
        "Restart a node",
        "restart-node:1.0.0:input",
        "restart-node:1.0.0:output",
        List.of("nodeId"),
        "LOW");
  }

  private static final class NeverRespondingModel implements Model {

    @Override
    public Flux<ChatResponse> stream(
        List<Msg> messages,
        List<ToolSchema> tools,
        GenerateOptions options) {
      return Flux.never();
    }

    @Override
    public String getModelName() {
      return "fake-timeout-model";
    }
  }
}
