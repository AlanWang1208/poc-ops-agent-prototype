package com.company.opsagent.executionworker;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;

import com.company.opsagent.contracts.workflow.OperatorContext;
import com.company.opsagent.contracts.workflow.PolicyDecisionReference;
import com.company.opsagent.contracts.workflow.ReadOnlyCommandEnvelope;
import com.company.opsagent.contracts.workflow.SkillReference;
import com.company.opsagent.contracts.workflow.TraceContext;
import com.company.opsagent.contracts.workflow.WorkerExecutionRequest;
import com.company.opsagent.contracts.workflow.WorkerExecutionStatus;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.time.OffsetDateTime;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;

/**
 * 验证通用 Worker 默认装配只包含通用只读 Skill 边界。
 */
class ExecutionWorkerConfigurationTest {

  private final ApplicationContextRunner contextRunner = new ApplicationContextRunner()
      .withUserConfiguration(ExecutionWorkerConfiguration.class)
      .withBean(ObjectMapper.class, ObjectMapper::new);

  /**
   * 验证默认装配已经通过通用 HTTP 适配器注册天气 Skill，但未配置天气源时失败关闭。
   */
  @Test
  void registersConfiguredHttpAdapterWithClosedWeatherDefault() {
    contextRunner.withPropertyValues(
        "ops-agent.worker.configured-http-skills.skills[0].skill-id=weather-current-read",
        "ops-agent.worker.configured-http-skills.skills[0].version=1.0.0",
        "ops-agent.worker.configured-http-skills.skills[0].endpoint-url=",
        "ops-agent.worker.configured-http-skills.skills[0].input-parameter-name=location",
        "ops-agent.worker.configured-http-skills.skills[0].query-parameter-name=location",
        "ops-agent.worker.configured-http-skills.skills[0].source=weather-read-model",
        "ops-agent.worker.configured-http-skills.skills[0].allowed-response-fields[0]=location"
    ).run(context -> {
      assertNotNull(context.getBean(WorkerHttpEgressProperties.class));
      assertNotNull(context.getBean(WorkerHttpEgressPolicy.class));
      assertNotNull(context.getBean(ConfiguredHttpReadOnlySkillProperties.class));

      var worker = context.getBean(RestrictedReadOnlyExecutionWorker.class);
      var result = worker.execute(weatherRequest());

      assertEquals(WorkerExecutionStatus.REJECTED, result.status());
      assertEquals("HTTP_SKILL_SOURCE_NOT_CONFIGURED", result.errorCode());
    });
  }

  private WorkerExecutionRequest weatherRequest() {
    OffsetDateTime now = OffsetDateTime.now();
    ObjectMapper objectMapper = new ObjectMapper();
    var command = new ReadOnlyCommandEnvelope(
        "1.0",
        "command-weather-1",
        "workflow-weather-1",
        "idempotency-weather-1",
        "READ_ONLY",
        "development",
        new SkillReference(
            "weather-current-read",
            "1.0.0",
            "weather-current-read:1.0.0:input",
            "weather-current-read:1.0.0:output"),
        objectMapper.createObjectNode().put("location", "Shanghai"),
        new OperatorContext("operator-1", List.of("ROLE_ops-reader")),
        new PolicyDecisionReference("decision-1", "policy-v1", "ALLOW"),
        new TraceContext("trace-1", "request-1"),
        now);
    return new WorkerExecutionRequest("1.0", "execution-weather-1", now, now.plusSeconds(30), command);
  }
}
