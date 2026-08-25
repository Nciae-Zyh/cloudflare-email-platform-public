PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS app_users (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL UNIQUE COLLATE NOCASE,
  password_hash TEXT NOT NULL,
  password_salt TEXT NOT NULL,
  password_iterations INTEGER NOT NULL DEFAULT 100000,
  domain_id TEXT NOT NULL,
  sender_local TEXT NOT NULL,
  sender_name TEXT NOT NULL DEFAULT '',
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
  created_by_admin_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  last_login_at TEXT,
  FOREIGN KEY (domain_id) REFERENCES domains(id) ON DELETE RESTRICT,
  FOREIGN KEY (created_by_admin_id) REFERENCES admins(id) ON DELETE RESTRICT,
  UNIQUE (domain_id, sender_local)
);

CREATE INDEX IF NOT EXISTS idx_app_users_domain_active
  ON app_users(domain_id, active, username);

CREATE TABLE IF NOT EXISTS user_sessions (
  token_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  last_seen_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES app_users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_user_sessions_user
  ON user_sessions(user_id, expires_at);

ALTER TABLE api_keys ADD COLUMN user_id TEXT
  REFERENCES app_users(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_api_keys_user
  ON api_keys(user_id, revoked_at, created_at DESC);

ALTER TABLE send_jobs ADD COLUMN user_id TEXT
  REFERENCES app_users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_send_jobs_user_time
  ON send_jobs(user_id, queued_at DESC);

ALTER TABLE audit_logs RENAME TO audit_logs_legacy;

CREATE TABLE audit_logs (
  id TEXT PRIMARY KEY,
  actor_type TEXT NOT NULL
    CHECK (actor_type IN ('admin', 'user', 'api_key', 'webhook', 'system')),
  actor_id TEXT,
  action TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  resource_id TEXT,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL
);

INSERT INTO audit_logs (
  id, actor_type, actor_id, action, resource_type,
  resource_id, metadata_json, created_at
)
SELECT
  id, actor_type, actor_id, action, resource_type,
  resource_id, metadata_json, created_at
FROM audit_logs_legacy;

DROP TABLE audit_logs_legacy;

CREATE INDEX IF NOT EXISTS idx_audit_logs_created
  ON audit_logs(created_at DESC);
