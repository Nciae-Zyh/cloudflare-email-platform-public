import { z } from 'zod'
import { compileEmailTemplate, EMAIL_LIMITS } from '../../shared/email-template'

const emailSchema = z.email()
const recipientsSchema = z.union([
  emailSchema.transform(value => [value]),
  z.array(emailSchema).max(EMAIL_LIMITS.maxRecipients)
])

export const sendPayloadSchema = z.object({
  to: recipientsSchema,
  cc: recipientsSchema.optional().default([]),
  bcc: recipientsSchema.optional().default([]),
  template_key: z.string().min(1).max(100).optional(),
  template_id: z.string().min(1).max(100).optional(),
  variables: z.record(z.string(), z.unknown()).optional().default({}),
  idempotency_key: z.string().min(8).max(200).optional(),
  priority: z.enum(['low', 'normal', 'high']).optional().default('normal')
})

type TemplateRow = {
  id: string
  domain_name: string
  sending_enabled: number
  default_from_local: string
  default_from_name: string
  default_reply_to: string | null
  template_config_json: string
  template_key: string
  subject_template: string
  content_mode: 'html' | 'markdown'
  html_template: string
  text_template: string | null
  from_local: string | null
  from_name: string | null
  reply_to: string | null
  status: string
}

function normalizeRecipients(
  to: string[],
  cc: string[],
  bcc: string[]
): [string[], string[], string[]] {
  const seen = new Set<string>()
  const normalize = (group: string[]) => group.map(
    value => value.trim().toLowerCase()
  ).filter((value) => {
    if (seen.has(value)) return false
    seen.add(value)
    return true
  })
  return [normalize(to), normalize(cc), normalize(bcc)]
}

function validateVariables(variables: Record<string, unknown>): void {
  if (Object.keys(variables).length > EMAIL_LIMITS.maxVariables) {
    throw createError({
      statusCode: 400,
      message: `模板变量最多 ${EMAIL_LIMITS.maxVariables} 个。`
    })
  }
  const serialized = JSON.stringify(variables)
  if (serialized.length > 100_000) {
    throw createError({
      statusCode: 413,
      message: '模板变量总大小不能超过 100 KB。'
    })
  }
}

function validateLocalPart(value: string): string {
  const local = value.trim()
  if (!/^[a-zA-Z0-9._+-]{1,64}$/.test(local)) {
    throw createError({
      statusCode: 400,
      message: '发件地址本地部分仅支持字母、数字、点、下划线、加号和连字符。'
    })
  }
  return local
}

export async function createEmailJob(
  env: CloudflareEnv,
  input: {
    domainId: string
    userId?: string | null
    forceFromLocal?: string
    forceFromName?: string | null
    source: 'manual' | 'rest' | 'webhook'
    sourceRef: string
    allowDraftTemplate?: boolean
    payload: z.output<typeof sendPayloadSchema>
  }
): Promise<{ jobId: string, status: 'queued', duplicate: boolean }> {
  const payload = input.payload
  validateVariables(payload.variables)
  const [to, cc, bcc] = normalizeRecipients(payload.to, payload.cc, payload.bcc)
  const recipientCount = to.length + cc.length + bcc.length
  if (!to.length || recipientCount > EMAIL_LIMITS.maxRecipients) {
    throw createError({
      statusCode: 400,
      message: `To 至少需要 1 个地址，To/Cc/Bcc 合计最多 ${EMAIL_LIMITS.maxRecipients} 个。`
    })
  }

  const lookupField = payload.template_id ? 't.id' : 't.template_key'
  const lookupValue = payload.template_id ?? payload.template_key
  if (!lookupValue) {
    throw createError({
      statusCode: 400,
      message: '必须提供 template_id 或 template_key。'
    })
  }

  const template = await env.DB.prepare(`
    SELECT t.id, d.name AS domain_name, d.sending_enabled,
           d.default_from_local, d.default_from_name, d.default_reply_to,
           d.template_config_json,
           t.template_key, t.subject_template, t.content_mode,
           t.html_template, t.text_template, t.from_local,
           t.from_name, t.reply_to, t.status
    FROM templates t
    JOIN domains d ON d.id = ?
    WHERE ${lookupField} = ?
  `).bind(input.domainId, lookupValue).first<TemplateRow>()

  if (!template) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Template not found'
    })
  }
  if (template.sending_enabled !== 1) {
    throw createError({
      statusCode: 409,
      message: `${template.domain_name} 尚未启用 Cloudflare Email Sending。`
    })
  }
  if (!input.allowDraftTemplate && template.status !== 'active') {
    throw createError({
      statusCode: 409,
      message: '外部调用只能使用已启用的邮件模板。'
    })
  }

  const compiled = compileEmailTemplate({
    subjectTemplate: template.subject_template,
    contentMode: template.content_mode,
    htmlTemplate: template.html_template,
    textTemplate: template.text_template,
    variables: mergeTemplateConfig(
      payload.variables,
      parseTemplateConfigJson(template.template_config_json)
    )
  })

  if (!compiled.subject || !compiled.html || !compiled.text) {
    throw createError({
      statusCode: 400,
      message: '模板渲染后主题、HTML 和纯文本内容都不能为空。'
    })
  }

  const localPart = validateLocalPart(
    input.forceFromLocal || template.from_local || template.default_from_local
  )
  const fromEmail = `${localPart}@${template.domain_name}`
  const now = new Date().toISOString()
  const jobId = crypto.randomUUID()

  try {
    await env.DB.prepare(`
      INSERT INTO send_jobs (
        id, domain_id, user_id, template_id, source, source_ref, idempotency_key,
        recipients_to, recipients_cc, recipients_bcc,
        from_email, from_name, reply_to, subject, html_body, text_body,
        priority, status, queued_at, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'queued', ?, ?)
    `).bind(
      jobId,
      input.domainId,
      input.userId ?? null,
      template.id,
      input.source,
      input.sourceRef,
      payload.idempotency_key ?? null,
      JSON.stringify(to),
      JSON.stringify(cc),
      JSON.stringify(bcc),
      fromEmail,
      input.forceFromName || template.from_name || template.default_from_name,
      template.reply_to || template.default_reply_to,
      compiled.subject,
      compiled.html,
      compiled.text,
      payload.priority,
      now,
      now
    ).run()
  } catch (error) {
    if (payload.idempotency_key && error instanceof Error && error.message.includes('UNIQUE')) {
      const existing = await env.DB.prepare(`
        SELECT id FROM send_jobs WHERE source_ref = ? AND idempotency_key = ?
      `).bind(input.sourceRef, payload.idempotency_key).first<{ id: string }>()
      if (existing) return { jobId: existing.id, status: 'queued', duplicate: true }
    }
    throw error
  }

  try {
    await env.EMAIL_QUEUE.send({ jobId })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    await env.DB.prepare(`
      UPDATE send_jobs
      SET status = 'failed', error_code = 'E_QUEUE_FAILED',
          error_message = ?, updated_at = ?
      WHERE id = ?
    `).bind(message.slice(0, 1000), new Date().toISOString(), jobId).run()
    throw createError({
      statusCode: 503,
      message: '邮件任务写入队列失败，请稍后重试。'
    })
  }

  return { jobId, status: 'queued', duplicate: false }
}
