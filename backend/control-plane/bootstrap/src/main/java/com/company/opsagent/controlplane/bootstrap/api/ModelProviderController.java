package com.company.opsagent.controlplane.bootstrap.api;

import com.company.opsagent.controlplane.bootstrap.security.PolicyEnforcementWebFilter;
import com.company.opsagent.controlplane.modules.agentruntime.DefaultModelProviderManagementService;
import com.company.opsagent.controlplane.modules.agentruntime.ModelProviderApiKeyCommand;
import com.company.opsagent.controlplane.modules.agentruntime.ModelProviderCreateCommand;
import com.company.opsagent.controlplane.modules.agentruntime.ModelProviderProbeResult;
import com.company.opsagent.controlplane.modules.agentruntime.ModelProviderSummary;
import com.company.opsagent.controlplane.modules.agentruntime.ModelProviderUpdateCommand;
import com.company.opsagent.controlplane.modules.audit.ExecutionContext;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.time.Duration;
import java.util.Iterator;
import java.util.List;
import java.util.Set;
import java.util.function.Supplier;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.web.server.ServerWebExchange;
import reactor.core.publisher.Mono;
import reactor.core.scheduler.Schedulers;

/**
 * 受策略、身份和审计保护的模型供应方配置入口。
 */
@RestController
@RequestMapping("/internal/model-providers")
public class ModelProviderController {

  private static final Set<String> CREATE_FIELDS = Set.of(
      "displayName",
      "baseUrl",
      "modelName",
      "apiKey",
      "timeoutSeconds",
      "maxIterations",
      "maxToolCalls",
      "maxToolCallDurationSeconds");

  private static final Set<String> UPDATE_FIELDS = Set.of(
      "displayName",
      "baseUrl",
      "modelName",
      "enabled",
      "timeoutSeconds",
      "maxIterations",
      "maxToolCalls",
      "maxToolCallDurationSeconds");

  private static final Set<String> API_KEY_FIELDS = Set.of("apiKey");

  private final DefaultModelProviderManagementService managementService;
  private final ObjectMapper objectMapper;

  public ModelProviderController(
      DefaultModelProviderManagementService managementService,
      ObjectMapper objectMapper) {
    this.managementService = managementService;
    this.objectMapper = objectMapper;
  }

  @GetMapping
  public Mono<List<ModelProviderSummary>> list() {
    return blocking(managementService::list);
  }

  @GetMapping("/{providerId}")
  public Mono<ModelProviderSummary> get(@PathVariable("providerId") String providerId) {
    return blocking(() -> managementService.get(providerId)
        .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "model provider not found")));
  }

  @PostMapping
  public Mono<ModelProviderSummary> create(
      @RequestBody JsonNode request,
      ServerWebExchange exchange) {
    ExecutionContext context = executionContext(exchange);
    return blocking(() -> managementService.create(parseCreateRequest(request), context.subject()));
  }

  @PatchMapping("/{providerId}")
  public Mono<ModelProviderSummary> update(
      @PathVariable("providerId") String providerId,
      @RequestBody JsonNode request,
      ServerWebExchange exchange) {
    ExecutionContext context = executionContext(exchange);
    return blocking(() -> managementService.update(
        providerId,
        parseUpdateRequest(providerId, request),
        context.subject()));
  }

  @PostMapping("/{providerId}/api-key")
  public Mono<ModelProviderSummary> rotateApiKey(
      @PathVariable("providerId") String providerId,
      @RequestBody JsonNode request,
      ServerWebExchange exchange) {
    ExecutionContext context = executionContext(exchange);
    return blocking(() -> managementService.rotateApiKey(
        providerId,
        parseApiKeyRequest(request),
        context.subject()));
  }

  @PostMapping("/{providerId}/test")
  public Mono<ModelProviderProbeResult> test(@PathVariable("providerId") String providerId) {
    return blocking(() -> managementService.test(providerId));
  }

  @PostMapping("/{providerId}/default")
  public Mono<ModelProviderSummary> setDefault(
      @PathVariable("providerId") String providerId,
      ServerWebExchange exchange) {
    ExecutionContext context = executionContext(exchange);
    return blocking(() -> managementService.setDefault(providerId, context.subject()));
  }

  @PostMapping("/{providerId}/disable")
  public Mono<ModelProviderSummary> disable(
      @PathVariable("providerId") String providerId,
      ServerWebExchange exchange) {
    ExecutionContext context = executionContext(exchange);
    return blocking(() -> managementService.disable(providerId, context.subject()));
  }

  private static <T> Mono<T> blocking(Supplier<T> supplier) {
    return Mono.fromSupplier(supplier).subscribeOn(Schedulers.boundedElastic());
  }

  private ModelProviderCreateCommand parseCreateRequest(JsonNode request) {
    validateObjectFields(request, CREATE_FIELDS, "model provider create request");
    CreateRequest parsed = parse(request, CreateRequest.class, "model provider create request is invalid");
    return new ModelProviderCreateCommand(
        parsed.displayName(),
        parsed.baseUrl(),
        parsed.modelName(),
        parsed.apiKey(),
        Duration.ofSeconds(seconds(parsed.timeoutSeconds(), 30, "timeoutSeconds")),
        positive(parsed.maxIterations(), 5, "maxIterations"),
        positive(parsed.maxToolCalls(), 5, "maxToolCalls"),
        Duration.ofSeconds(seconds(parsed.maxToolCallDurationSeconds(), 30, "maxToolCallDurationSeconds")));
  }

  private ModelProviderUpdateCommand parseUpdateRequest(String providerId, JsonNode request) {
    validateObjectFields(request, UPDATE_FIELDS, "model provider update request");
    UpdateRequest parsed = parse(request, UpdateRequest.class, "model provider update request is invalid");
    ModelProviderSummary existing = managementService.get(providerId)
        .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "model provider not found"));
    return new ModelProviderUpdateCommand(
        valueOr(parsed.displayName(), existing.displayName()),
        valueOr(parsed.baseUrl(), existing.baseUrl()),
        valueOr(parsed.modelName(), existing.modelName()),
        parsed.enabled() == null ? existing.enabled() : parsed.enabled(),
        Duration.ofSeconds(seconds(parsed.timeoutSeconds(), existing.timeout().toSeconds(), "timeoutSeconds")),
        positive(parsed.maxIterations(), existing.maxIterations(), "maxIterations"),
        positive(parsed.maxToolCalls(), existing.maxToolCalls(), "maxToolCalls"),
        Duration.ofSeconds(seconds(
            parsed.maxToolCallDurationSeconds(),
            existing.maxToolCallDuration().toSeconds(),
            "maxToolCallDurationSeconds")));
  }

  private ModelProviderApiKeyCommand parseApiKeyRequest(JsonNode request) {
    validateObjectFields(request, API_KEY_FIELDS, "model provider API Key request");
    ApiKeyRequest parsed = parse(request, ApiKeyRequest.class, "model provider API Key request is invalid");
    return new ModelProviderApiKeyCommand(parsed.apiKey());
  }

  private void validateObjectFields(JsonNode request, Set<String> allowedFields, String requestName) {
    if (request == null || !request.isObject()) {
      throw new IllegalArgumentException(requestName + " must be a JSON object");
    }
    Iterator<String> fieldNames = request.fieldNames();
    while (fieldNames.hasNext()) {
      String fieldName = fieldNames.next();
      if (!allowedFields.contains(fieldName)) {
        throw new IllegalArgumentException("unsupported " + requestName + " field: " + fieldName);
      }
    }
  }

  private <T> T parse(JsonNode request, Class<T> type, String errorMessage) {
    try {
      return objectMapper.treeToValue(request, type);
    } catch (JsonProcessingException exception) {
      throw new IllegalArgumentException(errorMessage, exception);
    }
  }

  private ExecutionContext executionContext(ServerWebExchange exchange) {
    return exchange.getRequiredAttribute(PolicyEnforcementWebFilter.EXECUTION_CONTEXT_ATTRIBUTE);
  }

  private static String valueOr(String value, String fallback) {
    return value == null ? fallback : value;
  }

  private static int positive(Integer value, int fallback, String fieldName) {
    int resolved = value == null ? fallback : value;
    if (resolved < 1) {
      throw new IllegalArgumentException(fieldName + " must be positive");
    }
    return resolved;
  }

  private static long seconds(Long value, long fallback, String fieldName) {
    long resolved = value == null ? fallback : value;
    if (resolved < 1) {
      throw new IllegalArgumentException(fieldName + " must be positive");
    }
    return resolved;
  }

  private record CreateRequest(
      String displayName,
      String baseUrl,
      String modelName,
      String apiKey,
      Long timeoutSeconds,
      Integer maxIterations,
      Integer maxToolCalls,
      Long maxToolCallDurationSeconds) {
  }

  private record UpdateRequest(
      String displayName,
      String baseUrl,
      String modelName,
      Boolean enabled,
      Long timeoutSeconds,
      Integer maxIterations,
      Integer maxToolCalls,
      Long maxToolCallDurationSeconds) {
  }

  private record ApiKeyRequest(String apiKey) {
  }
}
