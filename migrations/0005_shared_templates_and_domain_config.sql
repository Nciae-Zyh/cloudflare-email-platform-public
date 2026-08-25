ALTER TABLE domains
ADD COLUMN template_config_json TEXT NOT NULL DEFAULT '{}';

CREATE TABLE templates_shared (
  id TEXT PRIMARY KEY,
  template_key TEXT NOT NULL UNIQUE COLLATE NOCASE,
  name TEXT NOT NULL,
  description TEXT,
  subject_template TEXT NOT NULL,
  content_mode TEXT NOT NULL DEFAULT 'html'
    CHECK (content_mode IN ('html', 'markdown')),
  html_template TEXT NOT NULL,
  text_template TEXT,
  from_local TEXT,
  from_name TEXT,
  reply_to TEXT,
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'active', 'archived')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

INSERT INTO templates_shared (
  id,
  template_key,
  name,
  description,
  subject_template,
  content_mode,
  html_template,
  text_template,
  from_local,
  from_name,
  reply_to,
  status,
  created_at,
  updated_at
)
SELECT
  id,
  template_key,
  name,
  description,
  subject_template,
  content_mode,
  html_template,
  text_template,
  from_local,
  from_name,
  reply_to,
  status,
  created_at,
  updated_at
FROM (
  SELECT
    templates.*,
    ROW_NUMBER() OVER (
      PARTITION BY lower(template_key)
      ORDER BY
        CASE status
          WHEN 'active' THEN 0
          WHEN 'draft' THEN 1
          ELSE 2
        END,
        updated_at DESC,
        id ASC
    ) AS template_rank
  FROM templates
)
WHERE template_rank = 1;

CREATE TABLE webhooks_shared (
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
  FOREIGN KEY (template_id) REFERENCES templates_shared(id) ON DELETE CASCADE
);

INSERT INTO webhooks_shared (
  id,
  domain_id,
  template_id,
  name,
  secret_prefix,
  secret_hash,
  active,
  last_used_at,
  created_at,
  updated_at
)
SELECT
  webhooks.id,
  webhooks.domain_id,
  templates_shared.id,
  webhooks.name,
  webhooks.secret_prefix,
  webhooks.secret_hash,
  webhooks.active,
  webhooks.last_used_at,
  webhooks.created_at,
  webhooks.updated_at
FROM webhooks
JOIN templates
  ON templates.id = webhooks.template_id
JOIN templates_shared
  ON templates_shared.template_key = templates.template_key COLLATE NOCASE;

CREATE TABLE send_jobs_shared (
  id TEXT PRIMARY KEY,
  domain_id TEXT NOT NULL,
  user_id TEXT,
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
  priority TEXT NOT NULL DEFAULT 'normal'
    CHECK (priority IN ('low', 'normal', 'high')),
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
  FOREIGN KEY (user_id) REFERENCES app_users(id) ON DELETE SET NULL,
  FOREIGN KEY (template_id) REFERENCES templates_shared(id) ON DELETE SET NULL
);

INSERT INTO send_jobs_shared (
  id,
  domain_id,
  user_id,
  template_id,
  source,
  source_ref,
  idempotency_key,
  recipients_to,
  recipients_cc,
  recipients_bcc,
  from_email,
  from_name,
  reply_to,
  subject,
  html_body,
  text_body,
  priority,
  status,
  attempts,
  message_id,
  error_code,
  error_message,
  queued_at,
  started_at,
  sent_at,
  updated_at
)
SELECT
  send_jobs.id,
  send_jobs.domain_id,
  send_jobs.user_id,
  templates_shared.id,
  send_jobs.source,
  send_jobs.source_ref,
  send_jobs.idempotency_key,
  send_jobs.recipients_to,
  send_jobs.recipients_cc,
  send_jobs.recipients_bcc,
  send_jobs.from_email,
  send_jobs.from_name,
  send_jobs.reply_to,
  send_jobs.subject,
  send_jobs.html_body,
  send_jobs.text_body,
  send_jobs.priority,
  send_jobs.status,
  send_jobs.attempts,
  send_jobs.message_id,
  send_jobs.error_code,
  send_jobs.error_message,
  send_jobs.queued_at,
  send_jobs.started_at,
  send_jobs.sent_at,
  send_jobs.updated_at
FROM send_jobs
LEFT JOIN templates
  ON templates.id = send_jobs.template_id
LEFT JOIN templates_shared
  ON templates_shared.template_key = templates.template_key COLLATE NOCASE;

DROP TABLE webhooks;
DROP TABLE send_jobs;
DROP TABLE templates;

ALTER TABLE templates_shared RENAME TO templates;
ALTER TABLE webhooks_shared RENAME TO webhooks;
ALTER TABLE send_jobs_shared RENAME TO send_jobs;

CREATE INDEX idx_templates_status_updated
  ON templates(status, updated_at DESC);

CREATE INDEX idx_webhooks_domain
  ON webhooks(domain_id, active);

CREATE UNIQUE INDEX idx_send_jobs_idempotency
  ON send_jobs(source_ref, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE INDEX idx_send_jobs_status_time
  ON send_jobs(status, queued_at DESC);

CREATE INDEX idx_send_jobs_domain_time
  ON send_jobs(domain_id, queued_at DESC);

CREATE INDEX idx_send_jobs_user_time
  ON send_jobs(user_id, queued_at DESC);
