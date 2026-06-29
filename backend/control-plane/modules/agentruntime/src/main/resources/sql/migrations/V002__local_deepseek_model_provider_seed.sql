insert into agent_model_provider (
  provider_id,
  display_name,
  provider_type,
  base_url,
  model_name,
  enabled,
  default_provider,
  timeout_seconds,
  max_iterations,
  max_tool_calls,
  max_tool_call_duration_seconds,
  api_key_ciphertext,
  api_key_nonce,
  api_key_algorithm,
  api_key_fingerprint,
  api_key_last_rotated_at,
  config_version,
  created_by,
  created_at,
  updated_by,
  updated_at
)
select
  'local-deepseek-default',
  'deepseek',
  'OPENAI_COMPATIBLE',
  'https://api.deepseek.com',
  'deepseek-v4-pro',
  true,
  not exists (
    select 1
    from agent_model_provider
    where default_provider = true
      and enabled = true
  ),
  30,
  5,
  5,
  30,
  'ihNX0eoe7+7QJGZ7doCDaW4RWKsS9LskyHxDihQfPgxWOWC+25CrHR+lfqW4JUXW7w==',
  'b3BzYWdlbnRzZWVk',
  'AES_GCM_V1',
  'fp_XMKCRAGIOQU',
  current_timestamp,
  1,
  'startup-seed',
  current_timestamp,
  'startup-seed',
  current_timestamp
where not exists (
  select 1
  from agent_model_provider
  where provider_id = 'local-deepseek-default'
     or (
       display_name = 'deepseek'
       and base_url = 'https://api.deepseek.com'
       and model_name = 'deepseek-v4-pro'
     )
);
