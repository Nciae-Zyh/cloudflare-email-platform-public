PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS admins (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL UNIQUE COLLATE NOCASE,
  password_hash TEXT NOT NULL,
  password_salt TEXT NOT NULL,
  password_iterations INTEGER NOT NULL DEFAULT 100000,
  created_at TEXT NOT NULL,
  last_login_at TEXT
);

CREATE TABLE IF NOT EXISTS admin_sessions (
  token_hash TEXT PRIMARY KEY,
  admin_id TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  last_seen_at TEXT NOT NULL,
  FOREIGN KEY (admin_id) REFERENCES admins(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_admin_sessions_admin
  ON admin_sessions(admin_id, expires_at);

CREATE TABLE IF NOT EXISTS login_attempts (
  id TEXT PRIMARY KEY,
  key_hash TEXT NOT NULL,
  attempted_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_login_attempts_key_time
  ON login_attempts(key_hash, attempted_at DESC);

CREATE TABLE IF NOT EXISTS domains (
  id TEXT PRIMARY KEY,
  zone_id TEXT NOT NULL,
  name TEXT NOT NULL UNIQUE COLLATE NOCASE,
  zone_status TEXT NOT NULL DEFAULT 'active',
  sending_enabled INTEGER NOT NULL DEFAULT 0 CHECK (sending_enabled IN (0, 1)),
  sending_domain_id TEXT,
  preview_enabled INTEGER NOT NULL DEFAULT 0 CHECK (preview_enabled IN (0, 1)),
  return_path_domain TEXT,
  dkim_selector TEXT,
  default_from_local TEXT NOT NULL DEFAULT 'noreply',
  default_from_name TEXT NOT NULL DEFAULT 'CloudMail Platform',
  default_reply_to TEXT,
  last_synced_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_domains_sending
  ON domains(sending_enabled, name);

CREATE INDEX IF NOT EXISTS idx_domains_zone
  ON domains(zone_id, name);

CREATE TABLE IF NOT EXISTS templates (
  id TEXT PRIMARY KEY,
  domain_id TEXT NOT NULL,
  template_key TEXT NOT NULL COLLATE NOCASE,
  name TEXT NOT NULL,
  description TEXT,
  subject_template TEXT NOT NULL,
  content_mode TEXT NOT NULL DEFAULT 'html' CHECK (content_mode IN ('html', 'markdown')),
  html_template TEXT NOT NULL,
  text_template TEXT,
  from_local TEXT,
  from_name TEXT,
  reply_to TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'archived')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (domain_id) REFERENCES domains(id) ON DELETE CASCADE,
  UNIQUE (domain_id, template_key)
);

CREATE INDEX IF NOT EXISTS idx_templates_domain_status
  ON templates(domain_id, status, updated_at DESC);

CREATE TABLE IF NOT EXISTS api_keys (
  id TEXT PRIMARY KEY,
  domain_id TEXT NOT NULL,
  name TEXT NOT NULL,
  key_prefix TEXT NOT NULL UNIQUE,
  secret_hash TEXT NOT NULL UNIQUE,
  last_used_at TEXT,
  created_at TEXT NOT NULL,
  revoked_at TEXT,
  FOREIGN KEY (domain_id) REFERENCES domains(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_api_keys_domain
  ON api_keys(domain_id, revoked_at);

CREATE TABLE IF NOT EXISTS webhooks (
  id TEXT PRIMARY KEY,
  domain_id TEXT NOT NULL,
  template_id TEXT NOT NULL,
  name TEXT NOT NULL,
  secret_prefix TEXT NOT NULL,
  secret_hash TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
  last_used_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (domain_id) REFERENCES domains(id) ON DELETE CASCADE,
  FOREIGN KEY (template_id) REFERENCES templates(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_webhooks_domain
  ON webhooks(domain_id, active);

CREATE TABLE IF NOT EXISTS send_jobs (
  id TEXT PRIMARY KEY,
  domain_id TEXT NOT NULL,
  template_id TEXT,
  source TEXT NOT NULL CHECK (source IN ('manual', 'rest', 'webhook')),
  source_ref TEXT NOT NULL,
  idempotency_key TEXT,
  recipients_to TEXT NOT NULL,
  recipients_cc TEXT NOT NULL DEFAULT '[]',
  recipients_bcc TEXT NOT NULL DEFAULT '[]',
  from_email TEXT NOT NULL,
  from_name TEXT,
  reply_to TEXT,
  subject TEXT NOT NULL,
  html_body TEXT NOT NULL,
  text_body TEXT NOT NULL,
  priority TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high')),
  status TEXT NOT NULL DEFAULT 'queued'
    CHECK (status IN ('queued', 'processing', 'retrying', 'sent', 'failed')),
  attempts INTEGER NOT NULL DEFAULT 0,
  message_id TEXT,
  error_code TEXT,
  error_message TEXT,
  queued_at TEXT NOT NULL,
  started_at TEXT,
  sent_at TEXT,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (domain_id) REFERENCES domains(id) ON DELETE RESTRICT,
  FOREIGN KEY (template_id) REFERENCES templates(id) ON DELETE SET NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_send_jobs_idempotency
  ON send_jobs(source_ref, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_send_jobs_status_time
  ON send_jobs(status, queued_at DESC);

CREATE INDEX IF NOT EXISTS idx_send_jobs_domain_time
  ON send_jobs(domain_id, queued_at DESC);

CREATE TABLE IF NOT EXISTS audit_logs (
  id TEXT PRIMARY KEY,
  actor_type TEXT NOT NULL CHECK (actor_type IN ('admin', 'api_key', 'webhook', 'system')),
  actor_id TEXT,
  action TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  resource_id TEXT,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_created
  ON audit_logs(created_at DESC);
