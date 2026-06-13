CREATE TABLE IF NOT EXISTS identity_account (
    account_id VARCHAR(120) PRIMARY KEY,
    username VARCHAR(120) NOT NULL UNIQUE,
    display_name VARCHAR(200),
    email VARCHAR(320),
    account_status VARCHAR(40) NOT NULL,
    password_state VARCHAR(40) NOT NULL,
    mfa_requirement VARCHAR(40) NOT NULL,
    failed_login_count INTEGER NOT NULL DEFAULT 0,
    locked_until TIMESTAMP WITH TIME ZONE,
    disabled_reason VARCHAR(500),
    last_login_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL
);

CREATE TABLE IF NOT EXISTS identity_account_role_grant (
    grant_id VARCHAR(120) PRIMARY KEY,
    account_id VARCHAR(120) NOT NULL,
    role_code VARCHAR(120) NOT NULL,
    grant_source VARCHAR(80) NOT NULL,
    effective_from TIMESTAMP WITH TIME ZONE NOT NULL,
    effective_to TIMESTAMP WITH TIME ZONE,
    created_by VARCHAR(120) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    revoked_by VARCHAR(120),
    revoked_at TIMESTAMP WITH TIME ZONE,
    CONSTRAINT fk_identity_role_grant_account
        FOREIGN KEY (account_id) REFERENCES identity_account (account_id)
);

CREATE TABLE IF NOT EXISTS identity_password_credential (
    credential_id VARCHAR(120) PRIMARY KEY,
    account_id VARCHAR(120) NOT NULL,
    hash_algorithm VARCHAR(80) NOT NULL,
    hash_parameters VARCHAR(500) NOT NULL,
    password_hash VARCHAR(1000) NOT NULL,
    password_version BIGINT NOT NULL,
    must_change_on_next_login BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    rotated_at TIMESTAMP WITH TIME ZONE,
    CONSTRAINT fk_identity_password_credential_account
        FOREIGN KEY (account_id) REFERENCES identity_account (account_id)
);

CREATE TABLE IF NOT EXISTS identity_account_session (
    session_id VARCHAR(120) PRIMARY KEY,
    account_id VARCHAR(120) NOT NULL,
    session_state VARCHAR(40) NOT NULL,
    issued_at TIMESTAMP WITH TIME ZONE NOT NULL,
    last_seen_at TIMESTAMP WITH TIME ZONE NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    absolute_expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    password_change_required BOOLEAN NOT NULL DEFAULT FALSE,
    revoked_at TIMESTAMP WITH TIME ZONE,
    revoked_reason VARCHAR(500),
    client_ip_hash VARCHAR(200),
    user_agent_hash VARCHAR(200),
    CONSTRAINT fk_identity_account_session_account
        FOREIGN KEY (account_id) REFERENCES identity_account (account_id)
);

CREATE TABLE IF NOT EXISTS identity_password_reset_ticket (
    ticket_id VARCHAR(120) PRIMARY KEY,
    account_id VARCHAR(120) NOT NULL,
    ticket_state VARCHAR(40) NOT NULL,
    issued_by VARCHAR(120) NOT NULL,
    issued_at TIMESTAMP WITH TIME ZONE NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    consumed_at TIMESTAMP WITH TIME ZONE,
    reason VARCHAR(500) NOT NULL,
    CONSTRAINT fk_identity_password_reset_ticket_account
        FOREIGN KEY (account_id) REFERENCES identity_account (account_id)
);

CREATE INDEX IF NOT EXISTS idx_identity_role_grant_account_id
    ON identity_account_role_grant (account_id);

CREATE INDEX IF NOT EXISTS idx_identity_password_credential_account_id
    ON identity_password_credential (account_id);

CREATE INDEX IF NOT EXISTS idx_identity_account_session_account_id
    ON identity_account_session (account_id);

CREATE INDEX IF NOT EXISTS idx_identity_password_reset_ticket_account_id
    ON identity_password_reset_ticket (account_id);
