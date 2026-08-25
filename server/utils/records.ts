import type {
  ApiKeyRecord,
  DomainRecord,
  SendLogRecord,
  TemplateRecord,
  UserRecord,
  WebhookRecord
} from '../../shared/types'

export function mapDomain(row: Record<string, unknown>): DomainRecord {
  return {
    id: String(row.id),
    zoneId: String(row.zone_id),
    name: String(row.name),
    zoneStatus: String(row.zone_status),
    sendingEnabled: Number(row.sending_enabled) === 1,
    sendingDomainId: row.sending_domain_id ? String(row.sending_domain_id) : null,
    previewEnabled: Number(row.preview_enabled) === 1,
    returnPathDomain: row.return_path_domain ? String(row.return_path_domain) : null,
    dkimSelector: row.dkim_selector ? String(row.dkim_selector) : null,
    defaultFromLocal: String(row.default_from_local),
    defaultFromName: String(row.default_from_name),
    defaultReplyTo: row.default_reply_to ? String(row.default_reply_to) : null,
    templateConfig: parseTemplateConfigJson(row.template_config_json),
    lastSyncedAt: String(row.last_synced_at)
  }
}

export function mapTemplate(row: Record<string, unknown>): TemplateRecord {
  return {
    id: String(row.id),
    templateKey: String(row.template_key),
    name: String(row.name),
    description: row.description ? String(row.description) : null,
    subjectTemplate: String(row.subject_template),
    contentMode: row.content_mode === 'markdown' ? 'markdown' : 'html',
    htmlTemplate: String(row.html_template),
    textTemplate: row.text_template ? String(row.text_template) : null,
    fromLocal: row.from_local ? String(row.from_local) : null,
    fromName: row.from_name ? String(row.from_name) : null,
    replyTo: row.reply_to ? String(row.reply_to) : null,
    status: row.status === 'active'
      ? 'active'
      : row.status === 'archived'
        ? 'archived'
        : 'draft',
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at)
  }
}

export function mapSendLog(row: Record<string, unknown>): SendLogRecord {
  return {
    id: String(row.id),
    userId: row.user_id ? String(row.user_id) : null,
    username: row.username ? String(row.username) : null,
    domainName: String(row.domain_name),
    templateName: row.template_name ? String(row.template_name) : null,
    source: row.source === 'rest' ? 'rest' : row.source === 'webhook' ? 'webhook' : 'manual',
    to: JSON.parse(String(row.recipients_to)) as string[],
    subject: String(row.subject),
    status: row.status as SendLogRecord['status'],
    attempts: Number(row.attempts),
    messageId: row.message_id ? String(row.message_id) : null,
    errorMessage: row.error_message ? String(row.error_message) : null,
    queuedAt: String(row.queued_at),
    sentAt: row.sent_at ? String(row.sent_at) : null
  }
}

export function mapApiKey(row: Record<string, unknown>): ApiKeyRecord {
  return {
    id: String(row.id),
    userId: row.user_id ? String(row.user_id) : null,
    username: row.username ? String(row.username) : null,
    senderEmail: row.sender_local && row.domain_name
      ? `${String(row.sender_local)}@${String(row.domain_name)}`
      : null,
    domainId: String(row.domain_id),
    domainName: String(row.domain_name),
    name: String(row.name),
    keyPrefix: String(row.key_prefix),
    lastUsedAt: row.last_used_at ? String(row.last_used_at) : null,
    createdAt: String(row.created_at),
    revokedAt: row.revoked_at ? String(row.revoked_at) : null
  }
}

export function mapUser(row: Record<string, unknown>): UserRecord {
  const domainName = String(row.domain_name)
  const senderLocal = String(row.sender_local)
  return {
    id: String(row.id),
    username: String(row.username),
    domainId: String(row.domain_id),
    domainName,
    senderLocal,
    senderName: String(row.sender_name ?? ''),
    senderEmail: `${senderLocal}@${domainName}`,
    active: Number(row.active) === 1,
    apiKeyCount: Number(row.api_key_count ?? 0),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
    lastLoginAt: row.last_login_at ? String(row.last_login_at) : null
  }
}

export function mapWebhook(row: Record<string, unknown>): WebhookRecord {
  return {
    id: String(row.id),
    domainId: String(row.domain_id),
    domainName: String(row.domain_name),
    templateId: String(row.template_id),
    templateName: String(row.template_name),
    name: String(row.name),
    secretPrefix: String(row.secret_prefix),
    active: Number(row.active) === 1,
    lastUsedAt: row.last_used_at ? String(row.last_used_at) : null,
    createdAt: String(row.created_at)
  }
}
