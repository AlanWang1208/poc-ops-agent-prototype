package com.company.opsagent.executionworker;

import com.company.opsagent.contracts.workflow.ReadOnlyCommandEnvelope;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.io.IOException;
import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Clock;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * 配置驱动的 HTTP/JSON 只读 Skill 适配器。
 *
 * <p>适用于只需要向受控 HTTP 源发送一个查询参数、再按输出 Schema 透传白名单字段的简单只读 Skill。
 */
public class ConfiguredHttpReadOnlySkillAdapter implements ReadOnlySkillAdapter {

  private final HttpClient httpClient;
  private final ObjectMapper objectMapper;
  private final Clock clock;
  private final WorkerHttpEgressPolicy egressPolicy;
  private final Map<String, ConfiguredHttpReadOnlySkillProperties.Skill> skillsByKey;

  public ConfiguredHttpReadOnlySkillAdapter(
      HttpClient httpClient,
      ObjectMapper objectMapper,
      Clock clock,
      WorkerHttpEgressPolicy egressPolicy,
      ConfiguredHttpReadOnlySkillProperties properties) {
    this.httpClient = httpClient;
    this.objectMapper = objectMapper;
    this.clock = clock;
    this.egressPolicy = egressPolicy;
    this.skillsByKey = index(properties);
  }

  @Override
  public boolean supports(String skillId, String version) {
    return skillsByKey.containsKey(key(skillId, version));
  }

  @Override
  public JsonNode execute(ReadOnlyCommandEnvelope command) {
    ConfiguredHttpReadOnlySkillProperties.Skill skill = skillsByKey.get(
        key(command.skill().skillId(), command.skill().version()));
    if (skill == null) {
      throw new IllegalArgumentException("configured HTTP skill is not registered");
    }
    String input = requiredInput(command, skill.getInputParameterName());
    URI endpoint = endpoint(skill.getEndpointUrl());
    JsonNode source = fetch(requestUri(endpoint, skill.getQueryParameterName(), input), skill);

    ObjectNode output = objectMapper.createObjectNode();
    for (String fieldName : skill.getAllowedResponseFields()) {
      JsonNode value = source.get(fieldName);
      if (value == null) {
        throw new IllegalStateException("HTTP skill response missing " + fieldName);
      }
      output.set(fieldName, value);
    }
    if (!skill.getSource().isBlank()) {
      output.put("source", skill.getSource());
    }
    output.put("generatedAt", clock.instant().toString());
    return output;
  }

  private Map<String, ConfiguredHttpReadOnlySkillProperties.Skill> index(
      ConfiguredHttpReadOnlySkillProperties properties) {
    return properties.getSkills().stream()
        .collect(Collectors.toMap(
            skill -> key(required(skill.getSkillId(), "skillId"), required(skill.getVersion(), "version")),
            skill -> skill,
            (left, right) -> {
              throw new IllegalArgumentException("configured HTTP skill must be unique");
            },
            LinkedHashMap::new));
  }

  private String requiredInput(ReadOnlyCommandEnvelope command, String inputParameterName) {
    String parameterName = required(inputParameterName, "inputParameterName");
    JsonNode inputNode = command.parameters().get(parameterName);
    if (inputNode == null || !inputNode.isTextual() || inputNode.asText().isBlank()) {
      throw new IllegalArgumentException(parameterName + " is required");
    }
    String input = inputNode.asText().trim();
    if (input.length() > 120) {
      throw new IllegalArgumentException(parameterName + " must not exceed 120 characters");
    }
    return input;
  }

  private URI endpoint(String endpointUrl) {
    if (endpointUrl == null || endpointUrl.isBlank()) {
      throw new WorkerHttpEgressException(
          "HTTP_SKILL_SOURCE_NOT_CONFIGURED",
          "configured HTTP skill endpoint is not configured");
    }
    try {
      URI endpoint = URI.create(endpointUrl);
      if (endpoint.getRawQuery() != null || endpoint.getFragment() != null || endpoint.getUserInfo() != null) {
        throw new WorkerHttpEgressException("HTTP_SKILL_ENDPOINT_INVALID", "configured HTTP skill endpoint is invalid");
      }
      return endpoint;
    } catch (IllegalArgumentException exception) {
      throw new WorkerHttpEgressException("HTTP_SKILL_ENDPOINT_INVALID", "configured HTTP skill endpoint is invalid");
    }
  }

  private JsonNode fetch(URI requestUri, ConfiguredHttpReadOnlySkillProperties.Skill skill) {
    egressPolicy.validate(requestUri);
    HttpRequest request = HttpRequest.newBuilder(requestUri)
        .timeout(skill.getTimeout())
        .header("Accept", "application/json")
        .GET()
        .build();
    try {
      HttpResponse<String> response = httpClient.send(
          request,
          HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));
      if (response.statusCode() < 200 || response.statusCode() >= 300) {
        throw new IllegalStateException("configured HTTP skill source returned non-success status");
      }
      return objectMapper.readTree(response.body());
    } catch (IOException exception) {
      throw new IllegalStateException("configured HTTP skill response could not be read", exception);
    } catch (InterruptedException exception) {
      Thread.currentThread().interrupt();
      throw new IllegalStateException("configured HTTP skill request was interrupted", exception);
    }
  }

  private URI requestUri(URI endpoint, String queryParameterName, String value) {
    String query = URLEncoder.encode(required(queryParameterName, "queryParameterName"), StandardCharsets.UTF_8)
        + "="
        + URLEncoder.encode(value, StandardCharsets.UTF_8);
    return URI.create(endpoint.toASCIIString() + "?" + query);
  }

  private String key(String skillId, String version) {
    return skillId + "@" + version;
  }

  private String required(String value, String name) {
    if (value == null || value.isBlank()) {
      throw new IllegalArgumentException(name + " is required");
    }
    return value.trim();
  }
}
