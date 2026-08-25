import type { MessageBatch } from '@cloudflare/workers-types'
import type { EmailQueueMessage } from '../../shared/types'

type SendJobRow = {
  id: string
  recipients_to: string
  recipients_cc: string
  recipients_bcc: string
  from_email: string
  from_name: string | null
  reply_to: string | null
  subject: string
  html_body: string
  text_body: string
  priority: 'low' | 'normal' | 'high'
  status: string
  attempts: number
}

export type QueueJobOutcome = {
  action: 'ack' | 'retry'
  delaySeconds?: number
}

type QueueJobProcessor = (
  message: EmailQueueMessage,
  env: CloudflareEnv
) => Promise<QueueJobOutcome>

export const QUEUE_CONSUMER_BUILD_MARKER = 'cloudmail-queue-consumer-v1'

function parseAddresses(value: string): string[] {
  const parsed: unknown = JSON.parse(value)
  return Array.isArray(parsed) && parsed.every(item => typeof item === 'string')
    ? parsed
    : []
}

function errorDetails(error: unknown): { code: string, message: string } {
  if (error instanceof Error) {
    const code = 'code' in error && typeof error.code === 'string'
      ? error.code
      : 'E_SEND_FAILED'
    return { code, message: error.message.slice(0, 1000) }
  }
  return { code: 'E_SEND_FAILED', message: String(error).slice(0, 1000) }
}

export async function processEmailQueueJob(
  message: EmailQueueMessage,
  env: CloudflareEnv
): Promise<QueueJobOutcome> {
  const now = new Date().toISOString()
  const staleBefore = new Date(Date.now() - 15 * 60 * 1000).toISOString()

  const claimed = await env.DB.prepare(`
    UPDATE send_jobs
    SET status = 'processing',
        attempts = attempts + 1,
        started_at = ?,
        updated_at = ?
    WHERE id = ?
      AND (
        status IN ('queued', 'retrying')
        OR (status = 'processing' AND started_at < ?)
      )
  `).bind(now, now, message.jobId, staleBefore).run()

  if (Number(claimed.meta.changes ?? 0) === 0) {
    const current = await env.DB.prepare(
      'SELECT status FROM send_jobs WHERE id = ?'
    ).bind(message.jobId).first<{ status: string }>()

    if (!current || current.status === 'sent' || current.status === 'failed') {
      return { action: 'ack' }
    }
    return { action: 'retry', delaySeconds: 60 }
  }

  const job = await env.DB.prepare(`
    SELECT id, recipients_to, recipients_cc, recipients_bcc,
           from_email, from_name, reply_to, subject, html_body,
           text_body, priority, status, attempts
    FROM send_jobs
    WHERE id = ?
  `).bind(message.jobId).first<SendJobRow>()

  if (!job) return { action: 'ack' }

  try {
    const to = parseAddresses(job.recipients_to)
    const cc = parseAddresses(job.recipients_cc)
    const bcc = parseAddresses(job.recipients_bcc)
    const priorityHeaders: Record<string, string> = job.priority === 'high'
      ? { 'Importance': 'high', 'X-Priority': '1' }
      : job.priority === 'low'
        ? { 'Importance': 'low', 'X-Priority': '5' }
        : {}

    const response = await env.EMAIL.send({
      from: job.from_name
        ? { email: job.from_email, name: job.from_name }
        : job.from_email,
      to,
      cc: cc.length ? cc : undefined,
      bcc: bcc.length ? bcc : undefined,
      replyTo: job.reply_to || undefined,
      subject: job.subject,
      html: job.html_body,
      text: job.text_body,
      headers: {
        ...priorityHeaders,
        'X-CloudMail-Job-ID': job.id
      }
    })

    const sentAt = new Date().toISOString()
    await env.DB.prepare(`
      UPDATE send_jobs
      SET status = 'sent',
          message_id = ?,
          error_code = NULL,
          error_message = NULL,
          sent_at = ?,
          updated_at = ?
      WHERE id = ?
    `).bind(response.messageId, sentAt, sentAt, job.id).run()

    console.log(JSON.stringify({
      event: 'email.sent',
      jobId: job.id,
      messageId: response.messageId,
      recipientCount: to.length + cc.length + bcc.length
    }))
    return { action: 'ack' }
  } catch (error) {
    const details = errorDetails(error)
    const failedAt = new Date().toISOString()
    const terminal = job.attempts >= 3

    await env.DB.prepare(`
      UPDATE send_jobs
      SET status = ?,
          error_code = ?,
          error_message = ?,
          updated_at = ?
      WHERE id = ?
    `).bind(
      terminal ? 'failed' : 'retrying',
      details.code,
      details.message,
      failedAt,
      job.id
    ).run()

    console.error(JSON.stringify({
      event: terminal ? 'email.failed' : 'email.retrying',
      jobId: job.id,
      attempt: job.attempts,
      errorCode: details.code,
      error: details.message
    }))

    return terminal
      ? { action: 'ack' }
      : { action: 'retry', delaySeconds: Math.min(300, 15 * 2 ** job.attempts) }
  }
}

export async function processEmailQueueBatch(
  batch: MessageBatch<EmailQueueMessage>,
  env: CloudflareEnv,
  processJob: QueueJobProcessor = processEmailQueueJob
): Promise<void> {
  console.log(JSON.stringify({
    event: 'email.queue.batch',
    marker: QUEUE_CONSUMER_BUILD_MARKER,
    batchSize: batch.messages.length
  }))

  for (const message of batch.messages) {
    const outcome = await processJob(message.body, env)
    if (outcome.action === 'retry') {
      message.retry({ delaySeconds: outcome.delaySeconds })
    } else {
      message.ack()
    }
  }
}
