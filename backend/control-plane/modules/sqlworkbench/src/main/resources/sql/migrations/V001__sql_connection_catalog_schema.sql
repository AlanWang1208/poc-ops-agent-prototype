create table if not exists sql_workbench_connection (
  connection_id varchar(128) primary key,
  display_name varchar(160) not null,
  target_environment varchar(32) not null,
  platform_type varchar(32) not null,
  host varchar(255) not null,
  port integer not null,
  default_schema varchar(128) not null,
  allowed_schemas clob not null,
  capabilities clob not null,
  credential_alias varchar(160) not null,
  status varchar(64) not null,
  max_rows_default integer not null,
  timeout_seconds_default integer not null
);

create index if not exists idx_sql_workbench_connection_environment
  on sql_workbench_connection (target_environment, platform_type);
