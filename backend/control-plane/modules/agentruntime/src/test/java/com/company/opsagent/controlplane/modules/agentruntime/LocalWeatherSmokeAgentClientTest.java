package com.company.opsagent.controlplane.modules.agentruntime;

import static org.junit.jupiter.api.Assertions.assertEquals;

import com.company.opsagent.contracts.agent.AgentToolCall;
import com.company.opsagent.contracts.agent.AgentToolResult;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.jupiter.api.Test;
import reactor.core.publisher.Mono;
import reactor.test.StepVerifier;

class LocalWeatherSmokeAgentClientTest {

  private final ObjectMapper objectMapper = new ObjectMapper();

  @Test
  void routesWeatherIntentThroughPlatformToolExecutor() {
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
              .put("location", toolCall.parameters().get("location"))
              .put("condition", "Sunny")
              .put("temperatureCelsius", 31.2),
          null,
          null,
          OffsetDateTime.parse("2026-06-24T10:00:00Z")));
    };
    var client = new LocalWeatherSmokeAgentClient();

    StepVerifier.create(client.run(new AgentscopeAgentInvocation(
            runtimeRequest(),
            List.of(weatherTool()),
            toolExecutor)))
        .assertNext(response -> {
          assertEquals("SUCCEEDED", response.status());
          assertEquals(1, response.toolCallCount());
          assertEquals(1, response.toolResults().size());
          assertEquals("Shanghai", response.toolResults().getFirst().output().path("location").asText());
        })
        .verifyComplete();

    AgentToolCall call = executedCall.get();
    assertEquals("weather-current-read", call.skill().skillId());
    assertEquals("development", call.targetEnvironment());
    assertEquals(Map.of("location", "Shanghai"), call.parameters());
  }

  private AgentRuntimeRequest runtimeRequest() {
    return new AgentRuntimeRequest(
        "task-1",
        "workflow-1",
        "workspace-default",
        "operator-1",
        List.of("ROLE_ops-reader"),
        "development",
        "今天天气怎么样",
        Map.of(),
        "trace-1",
        "request-1");
  }

  private AgentToolDescriptor weatherTool() {
    return new AgentToolDescriptor(
        "weather-current-read",
        "1.0.0",
        "Read current weather",
        "weather-current-read:1.0.0:input",
        "weather-current-read:1.0.0:output",
        List.of("location"),
        "READ_ONLY");
  }
}
