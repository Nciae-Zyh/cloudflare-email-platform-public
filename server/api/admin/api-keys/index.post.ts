import { z } from 'zod'
import { createSecret, sha256Base64Url } from '../../../utils/crypto'

const schema = z.object({
  domainId: z.string().min(1).max(100).optional(),
  userId: z.string().min(1).max(100).optional(),
  name: z.string().trim().min(1).max(120)
}).refine(value => Boolean(value.domainId) !== Boolean(value.userId), {
  message: 'domainId 和 userId 必须且只能提供一个。'
})

export default defineEventHandler(async (event) => {
  const admin = await requireAdmin(event)
  const env = useCloudflareEnv(event)
  const body = parseInput(schema, await readBody(event))
  const scope = body.userId
    ? await env.DB.prepare(`
        SELECT u.id AS user_id, u.domain_id, u.sender_local,
               u.active, d.name AS domain_name
        FROM app_users u
        JOIN domains d ON d.id = u.domain_id
        WHERE u.id = ?
      `).bind(body.userId).first<{
        user_id: string
        domain_id: string
        sender_local: string
        active: number
        domain_name: string
      }>()
    : await env.DB.prepare(`
        SELECT NULL AS user_id, id AS domain_id, NULL AS sender_local,
               1 AS active, name AS domain_name
        FROM domains WHERE id = ?
      `).bind(body.domainId).first<{
        user_id: null
        domain_id: string
        sender_local: null
        active: number
        domain_name: string
      }>()
  if (!scope) throw createError({ statusCode: 404, statusMessage: 'Scope not found' })
  if (scope.active !== 1) throw createError({ statusCode: 409, message: '用户已停用。' })

  const secret = createSecret('cmp_live_')
  const prefix = secret.slice(0, 16)
  const id = crypto.randomUUID()
  await env.DB.prepare(`
    INSERT INTO api_keys
      (id, domain_id, user_id, name, key_prefix, secret_hash, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).bind(
    id,
    scope.domain_id,
    scope.user_id,
    body.name,
    prefix,
    await sha256Base64Url(secret),
    new Date().toISOString()
  ).run()

  await writeAudit(env, {
    actorType: 'admin',
    actorId: admin.id,
    action: 'api_key.create',
    resourceType: 'api_key',
    resourceId: id,
    metadata: {
      domainId: scope.domain_id,
      userId: scope.user_id,
      senderEmail: scope.sender_local
        ? `${scope.sender_local}@${scope.domain_name}`
        : null,
      prefix
    }
  })

  return {
    id,
    key: secret,
    warning: 'API Key 只显示一次，请立即保存。'
  }
})
