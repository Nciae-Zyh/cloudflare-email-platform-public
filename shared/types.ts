export type DomainRecord = {
  id: string
  zoneId: string
  name: string
  zoneStatus: string
  sendingEnabled: boolean
  sendingDomainId: string | null
  previewEnabled: boolean
  returnPathDomain: string | null
  dkimSelector: string | null
  defaultFromLocal: string
  defaultFromName: string
  defaultReplyTo: string | null
  templateConfig: Record<string, unknown>
  lastSyncedAt: string
}

export type AccountRole = 'admin' | 'user'

export type AccountRecord = {
  id: string
  username: string
  role: AccountRole
  domainId: string | null
  domainName: string | null
  senderEmail: string | null
  senderName: string | null
}

export type UserRecord = {
  id: string
  username: string
  domainId: string
  domainName: string
  senderLocal: string
  senderName: string
  senderEmail: string
  active: boolean
  apiKeyCount: number
  createdAt: string
  updatedAt: string
  lastLoginAt: string | null
}

export type TemplateStatus = 'draft' | 'active' | 'archived'
export type TemplateContentMode = 'html' | 'markdown'

export type TemplateRecord = {
  id: string
  templateKey: string
  name: string
  description: string | null
  subjectTemplate: string
  contentMode: TemplateContentMode
  htmlTemplate: string
  textTemplate: string | null
  fromLocal: string | null
  fromName: string | null
  replyTo: string | null
  status: TemplateStatus
  createdAt: string
  updatedAt: string
}

export type SendJobStatus = 'queued' | 'processing' | 'retrying' | 'sent' | 'failed'

export type SendLogRecord = {
  id: string
  userId: string | null
  username: string | null
  domainName: string
  templateName: string | null
  source: 'manual' | 'rest' | 'webhook'
  to: string[]
  subject: string
  status: SendJobStatus
  attempts: number
  messageId: string | null
  errorMessage: string | null
  queuedAt: string
  sentAt: string | null
}

export type ApiKeyRecord = {
  id: string
  userId: string | null
  username: string | null
  senderEmail: string | null
  domainId: string
  domainName: string
  name: string
  keyPrefix: string
  lastUsedAt: string | null
  createdAt: string
  revokedAt: string | null
}

export type WebhookRecord = {
  id: string
  domainId: string
  domainName: string
  templateId: string
  templateName: string
  name: string
  secretPrefix: string
  active: boolean
  lastUsedAt: string | null
  createdAt: string
}

export type EmailQueueMessage = {
  jobId: string
}
