package com.company.opsagent.controlplane.modules.workflow;

import java.time.OffsetDateTime;
import org.springframework.r2dbc.core.DatabaseClient;
import org.springframework.r2dbc.core.DatabaseClient.GenericExecuteSpec;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

public class R2dbcAgentWorkflowStore implements AgentWorkflowStore {

  private final DatabaseClient databaseClient;

  public R2dbcAgentWorkflowStore(DatabaseClient databaseClient) {
    this.databaseClient = databaseClient;
  }

  @Override
  public Mono<StoredAgentWorkflow> createOrReuse(
      String workflowId,
      String workspaceId,
      String operatorId,
      String targetEnvironment,
      String idempotencyKey,
      OffsetDateTime createdAt) {
    return findByIdempotency(workspaceId, operatorId, targetEnvironment, idempotencyKey)
        .switchIfEmpty(Mono.defer(() -> create(
            workflowId,
            workspaceId,
            operatorId,
            targetEnvironment,
            idempotencyKey,
            createdAt)));
  }

  @Override
  public Mono<Void> appendToolStep(StoredAgentToolStep step) {
    return databaseClient.sql("""
            insert into agent_tool_step (
              workflow_id,
              workspace_id,
              step_sequence,
              tool_call_id,
              skill_id,
              skill_version,
              parameters_hash,
              policy_decision_id,
              status,
              requested_at,
              completed_at,
              error_code,
              error_message
            ) values (
              :workflowId,
              :workspaceId,
              :stepSequence,
              :toolCallId,
              :skillId,
              :skillVersion,
              :parametersHash,
              :policyDecisionId,
              :status,
              :requestedAt,
              :completedAt,
              :errorCode,
              :errorMessage
            )
            """)
        .bind("workflowId", step.workflowId())
        .bind("workspaceId", step.workspaceId())
        .bind("stepSequence", step.stepSequence())
        .bind("toolCallId", step.toolCallId())
        .bind("skillId", step.skillId())
        .bind("skillVersion", step.skillVersion())
        .bind("parametersHash", step.parametersHash())
        .bind("policyDecisionId", step.policyDecisionId())
        .bind("status", step.status().name())
        .bind("requestedAt", step.requestedAt())
        .bindNull("completedAt", OffsetDateTime.class)
        .bindNull("errorCode", String.class)
        .bindNull("errorMessage", String.class)
        .fetch()
        .rowsUpdated()
        .then(databaseClient.sql("""
            update agent_workflow
            set status = :status, updated_at = :updatedAt
            where workflow_id = :workflowId and status = :pendingStatus
            """)
            .bind("status", StoredWorkflowStatus.RUNNING.name())
            .bind("updatedAt", step.requestedAt())
            .bind("workflowId", step.workflowId())
            .bind("pendingStatus", StoredWorkflowStatus.PENDING.name())
            .fetch()
            .rowsUpdated())
        .then();
  }

  @Override
  public Mono<Void> markToolStepCompleted(
      String workspaceId,
      String workflowId,
      long stepSequence,
      StoredWorkflowStatus status,
      String errorCode,
      String errorMessage,
      OffsetDateTime completedAt) {
    GenericExecuteSpec spec = databaseClient.sql("""
            update agent_tool_step
            set status = :status,
                completed_at = :completedAt,
                error_code = :errorCode,
                error_message = :errorMessage
            where workspace_id = :workspaceId
              and workflow_id = :workflowId
              and step_sequence = :stepSequence
            """)
        .bind("status", status.name())
        .bind("completedAt", completedAt)
        .bind("workspaceId", workspaceId)
        .bind("workflowId", workflowId)
        .bind("stepSequence", stepSequence);
    spec = bindNullable(spec, "errorCode", errorCode, String.class);
    spec = bindNullable(spec, "errorMessage", errorMessage, String.class);
    return spec.fetch()
        .rowsUpdated()
        .flatMap(rows -> rows == 0
            ? Mono.error(new IllegalArgumentException("agent tool step not found"))
            : Mono.empty());
  }

  @Override
  public Mono<Void> markWorkflowCompleted(
      String workspaceId,
      String workflowId,
      StoredWorkflowStatus status,
      OffsetDateTime completedAt) {
    return databaseClient.sql("""
            update agent_workflow
            set status = :status,
                updated_at = :updatedAt,
                completed_at = :completedAt
            where workspace_id = :workspaceId and workflow_id = :workflowId
            """)
        .bind("status", status.name())
        .bind("updatedAt", completedAt)
        .bind("completedAt", completedAt)
        .bind("workspaceId", workspaceId)
        .bind("workflowId", workflowId)
        .fetch()
        .rowsUpdated()
        .flatMap(rows -> rows == 0
            ? Mono.error(new IllegalArgumentException("agent workflow not found"))
            : Mono.empty());
  }

  @Override
  public Flux<StoredAgentToolStep> findToolStepsAfter(String workspaceId, String workflowId, long afterSequence) {
    return databaseClient.sql("""
            select *
            from agent_tool_step
            where workspace_id = :workspaceId
              and workflow_id = :workflowId
              and step_sequence > :afterSequence
            order by step_sequence asc
            """)
        .bind("workspaceId", workspaceId)
        .bind("workflowId", workflowId)
        .bind("afterSequence", afterSequence)
        .map((row, metadata) -> new StoredAgentToolStep(
            row.get("workflow_id", String.class),
            row.get("workspace_id", String.class),
            row.get("step_sequence", Long.class),
            row.get("tool_call_id", String.class),
            row.get("skill_id", String.class),
            row.get("skill_version", String.class),
            row.get("parameters_hash", String.class),
            row.get("policy_decision_id", String.class),
            StoredWorkflowStatus.valueOf(row.get("status", String.class)),
            row.get("requested_at", OffsetDateTime.class),
            row.get("completed_at", OffsetDateTime.class),
            row.get("error_code", String.class),
            row.get("error_message", String.class)))
        .all();
  }

  private Mono<StoredAgentWorkflow> create(
      String workflowId,
      String workspaceId,
      String operatorId,
      String targetEnvironment,
      String idempotencyKey,
      OffsetDateTime createdAt) {
    return databaseClient.sql("""
            insert into agent_workflow (
              workflow_id,
              workspace_id,
              operator_id,
              target_environment,
              idempotency_key,
              status,
              created_at,
              updated_at
            ) values (
              :workflowId,
              :workspaceId,
              :operatorId,
              :targetEnvironment,
              :idempotencyKey,
              :status,
              :createdAt,
              :updatedAt
            )
            """)
        .bind("workflowId", workflowId)
        .bind("workspaceId", workspaceId)
        .bind("operatorId", operatorId)
        .bind("targetEnvironment", targetEnvironment)
        .bind("idempotencyKey", idempotencyKey)
        .bind("status", StoredWorkflowStatus.PENDING.name())
        .bind("createdAt", createdAt)
        .bind("updatedAt", createdAt)
        .fetch()
        .rowsUpdated()
        .then(databaseClient.sql("""
            insert into agent_workflow_idempotency (
              workspace_id,
              operator_id,
              target_environment,
              idempotency_key,
              workflow_id
            ) values (
              :workspaceId,
              :operatorId,
              :targetEnvironment,
              :idempotencyKey,
              :workflowId
            )
            """)
            .bind("workspaceId", workspaceId)
            .bind("operatorId", operatorId)
            .bind("targetEnvironment", targetEnvironment)
            .bind("idempotencyKey", idempotencyKey)
            .bind("workflowId", workflowId)
            .fetch()
            .rowsUpdated())
        .then(findByWorkflowId(workspaceId, workflowId));
  }

  private Mono<StoredAgentWorkflow> findByIdempotency(
      String workspaceId,
      String operatorId,
      String targetEnvironment,
      String idempotencyKey) {
    return databaseClient.sql("""
            select workflow_id
            from agent_workflow_idempotency
            where workspace_id = :workspaceId
              and operator_id = :operatorId
              and target_environment = :targetEnvironment
              and idempotency_key = :idempotencyKey
            """)
        .bind("workspaceId", workspaceId)
        .bind("operatorId", operatorId)
        .bind("targetEnvironment", targetEnvironment)
        .bind("idempotencyKey", idempotencyKey)
        .map((row, metadata) -> row.get("workflow_id", String.class))
        .one()
        .flatMap(workflowId -> findByWorkflowId(workspaceId, workflowId));
  }

  private Mono<StoredAgentWorkflow> findByWorkflowId(String workspaceId, String workflowId) {
    return databaseClient.sql("""
            select *
            from agent_workflow
            where workspace_id = :workspaceId and workflow_id = :workflowId
            """)
        .bind("workspaceId", workspaceId)
        .bind("workflowId", workflowId)
        .map((row, metadata) -> new StoredAgentWorkflow(
            row.get("workflow_id", String.class),
            row.get("workspace_id", String.class),
            row.get("operator_id", String.class),
            row.get("target_environment", String.class),
            row.get("idempotency_key", String.class),
            StoredWorkflowStatus.valueOf(row.get("status", String.class)),
            row.get("created_at", OffsetDateTime.class),
            row.get("updated_at", OffsetDateTime.class),
            row.get("completed_at", OffsetDateTime.class)))
        .one();
  }

  private GenericExecuteSpec bindNullable(
      GenericExecuteSpec spec,
      String name,
      Object value,
      Class<?> type) {
    return value == null ? spec.bindNull(name, type) : spec.bind(name, value);
  }
}
