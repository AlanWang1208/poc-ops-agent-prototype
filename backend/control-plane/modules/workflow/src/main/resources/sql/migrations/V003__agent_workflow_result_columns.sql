alter table if exists agent_workflow
  add column if not exists result_status varchar(64);

alter table if exists agent_workflow
  add column if not exists result_summary clob;

alter table if exists agent_workflow
  add column if not exists result_tool_call_count integer;
