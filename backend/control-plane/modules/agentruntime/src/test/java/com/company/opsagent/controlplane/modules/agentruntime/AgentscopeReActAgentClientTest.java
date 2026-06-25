package com.company.opsagent.controlplane.modules.agentruntime;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.company.opsagent.contracts.agent.AgentToolCall;
import com.company.opsagent.contracts.agent.AgentToolResult;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.agentscope.core.message.Msg;
import io.agentscope.core.message.TextBlock;
import io.agentscope.core.message.ToolResultBlock;
import io.agentscope.core.message.ToolUseBlock;
import io.agentscope.core.model.ChatResponse;
import io.agentscope.core.model.GenerateOptions;
import io.agentscope.core.model.Model;
import io.agentscope.core.model.ToolSchema;
import java.time.Duration;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Map;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.jupiter.api.Test;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;
import reactor.test.StepVerifier;

class AgentscopeReActAgentClientTest {

  private final ObjectMapper objectMapper = new ObjectMapper();

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
            List.of(readOnlyTool()),
            unusedToolExecutor())))
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

  @Test
  void executesModelToolUseThroughPlatformToolExecutorAndFeedsResultBackToReAct() {
    var executedCall = new AtomicReference<AgentToolCall>();
    AgentToolExecutor toolExecutor = (runtimeRequest, toolCall) -> {
      executedCall.set(toolCall);
      return Mono.just(new AgentToolResult(
          "1.0",
          toolCall.toolCallId(),
          toolCall.taskId(),
          toolCall.workflowId(),
          "SUCCEEDED",
          toolCall.skill().outputSchemaId(),
          objectMapper.createObjectNode()
              .put("nodeId", toolCall.parameters().get("nodeId"))
              .put("status", "UP"),
          null,
          null,
          OffsetDateTime.of(2026, 6, 23, 10, 0, 0, 0, ZoneOffset.UTC)));
    };
    var model = new TwoStepToolUseModel();
    var client = new AgentscopeReActAgentClient(model, 4, Duration.ofSeconds(5));

    StepVerifier.create(client.run(new AgentscopeAgentInvocation(
            runtimeRequest(),
            List.of(readOnlyTool()),
            toolExecutor)))
        .assertNext(response -> {
          assertEquals("SUCCEEDED", response.status());
          assertEquals("node-1 is healthy", response.summary());
          assertEquals(1, response.toolCallCount());
          assertEquals(1, response.toolResults().size());
          assertEquals("SUCCEEDED", response.toolResults().getFirst().status());
          assertEquals("UP", response.toolResults().getFirst().output().path("status").asText());
        })
        .verifyComplete();

    AgentToolCall call = executedCall.get();
    assertNotNull(call);
    assertEquals("tool-call-1", call.toolCallId());
    assertEquals("task-1", call.taskId());
    assertEquals("workflow-1", call.workflowId());
    assertEquals(1, call.stepSequence());
    assertEquals("node-health", call.skill().skillId());
    assertEquals("1.0.0", call.skill().version());
    assertEquals("development", call.targetEnvironment());
    assertEquals(Map.of("nodeId", "node-1"), call.parameters());
    assertEquals("trace-1", call.trace().traceId());
    assertEquals("request-1", call.trace().requestId());
  }

  private AgentRuntimeRequest runtimeRequest() {
    return new AgentRuntimeRequest(
        "task-1",
        "workflow-1",
        "workspace-default",
        "operator-1",
        List.of("ROLE_ops-reader"),
        "development",
        "check node health",
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

  private AgentToolExecutor unusedToolExecutor() {
    return (runtimeRequest, toolCall) -> Mono.error(
        new AssertionError("tool executor must not be called without a model tool use"));
  }

  private static final class TwoStepToolUseModel implements Model {

    private int streamCalls;

    @Override
    public Flux<ChatResponse> stream(
        List<Msg> messages,
        List<ToolSchema> tools,
        GenerateOptions options) {
      streamCalls++;
      if (streamCalls == 1) {
        assertEquals(List.of("node-health"), tools.stream()
            .map(ToolSchema::getName)
            .toList());
        return Flux.just(ChatResponse.builder()
            .id("response-tool-use")
            .content(List.of(ToolUseBlock.builder()
                .id("tool-call-1")
                .name("node-health")
                .input(Map.of("nodeId", "node-1"))
                .content("{\"nodeId\":\"node-1\"}")
                .build()))
            .finishReason("tool_calls")
            .build());
      }

      List<String> toolResultText = messages.stream()
          .flatMap(message -> message.getContentBlocks(ToolResultBlock.class).stream())
          .flatMap(block -> block.getOutput().stream())
          .filter(TextBlock.class::isInstance)
          .map(TextBlock.class::cast)
          .map(TextBlock::getText)
          .toList();
      assertEquals(1, toolResultText.size());
      String result = toolResultText.getFirst();
      assertTrue(result.contains("\"status\":\"SUCCEEDED\""), result);
      assertTrue(result.contains("\"UP\""), result);
      return Flux.just(ChatResponse.builder()
          .id("response-final")
          .content(List.of(TextBlock.builder().text("node-1 is healthy").build()))
          .finishReason("stop")
          .build());
    }

    @Override
    public String getModelName() {
      return "fake-tool-model";
    }
  }
}
