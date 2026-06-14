package com.company.opsagent.controlplane.modules.agentruntime;

import static org.junit.jupiter.api.Assertions.assertEquals;

import io.agentscope.core.message.Msg;
import io.agentscope.core.message.TextBlock;
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
import reactor.test.StepVerifier;

class AgentscopeReActAgentClientTest {

  @Test
  void runsReActAgentWithReadOnlyToolSchemasAndReturnsFinalText() {
    AtomicReference<List<ToolSchema>> toolSchemas = new AtomicReference<>();
    Model model = new Model() {
      @Override
      public Flux<ChatResponse> stream(
          List<Msg> messages,
          List<ToolSchema> tools,
          GenerateOptions options) {
        toolSchemas.set(tools);
        return Flux.just(ChatResponse.builder()
            .id("response-1")
            .content(List.of(TextBlock.builder().text("node-1 is healthy").build()))
            .finishReason("stop")
            .build());
      }

      @Override
      public String getModelName() {
        return "fake-model";
      }
    };
    var client = new AgentscopeReActAgentClient(model, 3, Duration.ofSeconds(5));

    StepVerifier.create(client.run(new AgentscopeAgentInvocation(
            runtimeRequest(),
            List.of(readOnlyTool()))))
        .assertNext(response -> {
          assertEquals("SUCCEEDED", response.status());
          assertEquals("node-1 is healthy", response.summary());
          assertEquals(0, response.toolCallCount());
        })
        .verifyComplete();

    assertEquals(List.of("node-health"), toolSchemas.get().stream()
        .map(ToolSchema::getName)
        .toList());
  }

  private AgentRuntimeRequest runtimeRequest() {
    return new AgentRuntimeRequest(
        "task-1",
        "workflow-1",
        "workspace-default",
        "operator-1",
        "development",
        "check node health",
        Map.of("nodeId", "node-1"));
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
}
