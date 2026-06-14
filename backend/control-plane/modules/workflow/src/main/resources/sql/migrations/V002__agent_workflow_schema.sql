create table if not exists agent_workflow (
  workflow_id varchar(64) primary key,
  workspace_id varchar(128) not null,
  operator_id varchar(128) not null,
  target_environment varchar(64) not null,
  idempotency_key varchar(128) not null,
  status varchar(32) not null,
  created_at timestamp with time zone not null,
  updated_at timestamp with time zone not null,
  completed_at timestamp with time zone
);

create table if not exists agent_workflow_idempotency (
  workspace_id varchar(128) not null,
  operator_id varchar(128) not null,
  target_environment varchar(64) not null,
  idempotency_key varchar(128) not null,
  workflow_id varchar(64) not null,
  primary key (workspace_id, operator_id, target_environment, idempotency_key)
);

create table if not exists agent_tool_step (
  workflow_id varchar(64) not null,
  workspace_id varchar(128) not null,
  step_sequence bigint not null,
  tool_call_id varchar(64) not null,
  skill_id varchar(128) not null,
  skill_version varchar(64) not null,
  parameters_hash varchar(128) not null,
  policy_decision_id varchar(128) not null,
  status varchar(32) not null,
  requested_at timestamp with time zone not null,
  completed_at timestamp with time zone,
  error_code varchar(128),
  error_message clob,
  primary key (workflow_id, step_sequence)
);

create index if not exists idx_agent_tool_step_workspace_workflow_sequence
  on agent_tool_step (workspace_id, workflow_id, step_sequence);
