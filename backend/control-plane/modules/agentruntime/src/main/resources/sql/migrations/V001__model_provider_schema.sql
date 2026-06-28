create table if not exists agent_model_provider (
  provider_id varchar(64) primary key,
  display_name varchar(160) not null,
  provider_type varchar(64) not null,
  base_url varchar(512) not null,
  model_name varchar(256) not null,
  enabled boolean not null,
  default_provider boolean not null,
  timeout_seconds bigint not null,
  max_iterations integer not null,
  max_tool_calls integer not null,
  max_tool_call_duration_seconds bigint not null,
  api_key_ciphertext clob not null,
  api_key_nonce varchar(128) not null,
  api_key_algorithm varchar(64) not null,
  api_key_fingerprint varchar(128) not null,
  api_key_last_rotated_at timestamp with time zone not null,
  config_version bigint not null,
  created_by varchar(128) not null,
  created_at timestamp with time zone not null,
  updated_by varchar(128) not null,
  updated_at timestamp with time zone not null
);

create index if not exists idx_agent_model_provider_default
  on agent_model_provider (default_provider, enabled);
