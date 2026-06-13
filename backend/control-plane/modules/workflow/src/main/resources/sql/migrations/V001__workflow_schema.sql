create table if not exists workflow_instance (
  workflow_id varchar(64) primary key,
  idempotency_key varchar(128) not null,
  operator_id varchar(128) not null,
  target_environment varchar(64) not null,
  skill_id varchar(128) not null,
  skill_version varchar(64) not null,
  parameters_hash varchar(128) not null,
  status varchar(32) not null,
  policy_decision_id varchar(128) not null,
  policy_version varchar(64) not null,
  trace_id varchar(128) not null,
  request_id varchar(128) not null,
  command_id varchar(64) not null,
  command_json clob not null,
  current_attempt_no integer not null,
  max_replay_count integer not null,
  replay_count integer not null,
  result_status varchar(32),
  result_schema_id varchar(256),
  result_payload_json clob,
  error_code varchar(128),
  error_message clob,
  created_at timestamp with time zone not null,
  updated_at timestamp with time zone not null,
  completed_at timestamp with time zone
);

create table if not exists workflow_idempotency (
  idempotency_key varchar(128) not null,
  operator_id varchar(128) not null,
  target_environment varchar(64) not null,
  skill_id varchar(128) not null,
  parameters_hash varchar(128) not null,
  workflow_id varchar(64) not null,
  primary key (idempotency_key, operator_id, target_environment, skill_id, parameters_hash)
);

create table if not exists workflow_attempt (
  workflow_id varchar(64) not null,
  attempt_no integer not null,
  execution_request_id varchar(64) not null,
  attempt_kind varchar(16) not null,
  status varchar(32) not null,
  started_at timestamp with time zone not null,
  completed_at timestamp with time zone,
  expires_at timestamp with time zone,
  worker_error_code varchar(128),
  worker_error_message clob,
  retryable boolean not null default false,
  primary key (workflow_id, attempt_no)
);

create table if not exists workflow_event (
  workflow_id varchar(64) not null,
  sequence bigint not null,
  event_id varchar(64) not null,
  event_type varchar(64) not null,
  event_payload_json clob not null,
  created_at timestamp with time zone not null,
  primary key (workflow_id, sequence)
);
