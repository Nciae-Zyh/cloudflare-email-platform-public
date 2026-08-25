import type { H3Event } from 'h3'
import { getHeader } from 'h3'
import { sha256Base64Url } from './crypto'

export type AuthenticatedApiKey = {
  id: string
  domainId: string
  domainName: string
  userId: string | null
  senderLocal: string | null
  senderName: string | null
}

export async function authenticateApiKey(
  event: H3Event,
  env: CloudflareEnv
): Promise<AuthenticatedApiKey> {
  const authorization = getHeader(event, 'authorization') ?? ''
  const match = authorization.match(/^Bearer\s+(.+)$/i)
  if (!match?.[1]) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Missing API key',
      message: '请使用 Authorization: Bearer <API_KEY>。'
    })
  }

  const secretHash = await sha256Base64Url(match[1])
  const row = await env.DB.prepare(`
    SELECT k.id, k.domain_id, k.user_id, d.name AS domain_name,
           u.sender_local, u.sender_name, u.active AS user_active,
           u.domain_id AS user_domain_id
    FROM api_keys k
    JOIN domains d ON d.id = k.domain_id
    LEFT JOIN app_users u ON u.id = k.user_id
    WHERE k.secret_hash = ? AND k.revoked_at IS NULL
  `).bind(secretHash).first<{
    id: string
    domain_id: string
    domain_name: string
    user_id: string | null
    sender_local: string | null
    sender_name: string | null
    user_active: number | null
    user_domain_id: string | null
  }>()

  if (
    !row
    || (row.user_id && (row.user_active !== 1 || row.user_domain_id !== row.domain_id))
  ) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Invalid API key'
    })
  }

  await env.DB.prepare(
    'UPDATE api_keys SET last_used_at = ? WHERE id = ?'
  ).bind(new Date().toISOString(), row.id).run()

  return {
    id: row.id,
    domainId: row.domain_id,
    domainName: row.domain_name,
    userId: row.user_id,
    senderLocal: row.sender_local,
    senderName: row.sender_name
  }
}

export async function authenticateWebhook(
  event: H3Event,
  env: CloudflareEnv,
  webhookId: string
): Promise<{
  id: string
  domainId: string
  templateId: string
}> {
  const secret = getHeader(event, 'x-webhook-secret')
  if (!secret) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Missing webhook secret',
      message: '请提供 X-Webhook-Secret 请求头。'
    })
  }

  const secretHash = await sha256Base64Url(secret)
  const row = await env.DB.prepare(`
    SELECT id, domain_id, template_id
    FROM webhooks
    WHERE id = ? AND secret_hash = ? AND active = 1
  `).bind(webhookId, secretHash).first<{
    id: string
    domain_id: string
    template_id: string
  }>()

  if (!row) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Invalid webhook credentials'
    })
  }

  await env.DB.prepare(
    'UPDATE webhooks SET last_used_at = ?, updated_at = ? WHERE id = ?'
  ).bind(new Date().toISOString(), new Date().toISOString(), row.id).run()

  return {
    id: row.id,
    domainId: row.domain_id,
    templateId: row.template_id
  }
}
