import { z } from 'zod'
import { createSecret, sha256Base64Url } from '../../../utils/crypto'

const schema = z.object({
  domainId: z.string().min(1).max(100),
  templateId: z.string().min(1).max(100),
  name: z.string().trim().min(1).max(120)
})

export default defineEventHandler(async (event) => {
  const admin = await requireAdmin(event)
  const env = useCloudflareEnv(event)
  const body = parseInput(schema, await readBody(event))
  const template = await env.DB.prepare(`
    SELECT t.id, d.id AS domain_id
    FROM templates t
    JOIN domains d ON d.id = ? AND d.sending_enabled = 1
    WHERE t.id = ? AND t.status = 'active'
  `).bind(body.domainId, body.templateId).first<{
    id: string
    domain_id: string
  }>()
  if (!template) {
    throw createError({
      statusCode: 404,
      message: 'Webhook 只能绑定已启用模板和可发送域名。'
    })
  }

  const secret = createSecret('whsec_')
  const id = crypto.randomUUID()
  const now = new Date().toISOString()
  await env.DB.prepare(`
    INSERT INTO webhooks (
      id, domain_id, template_id, name, secret_prefix,
      secret_hash, active, created_at, updated_at
    )
    VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)
  `).bind(
    id,
    template.domain_id,
    template.id,
    body.name,
    secret.slice(0, 14),
    await sha256Base64Url(secret),
    now,
    now
  ).run()

  await writeAudit(env, {
    actorType: 'admin',
    actorId: admin.id,
    action: 'webhook.create',
    resourceType: 'webhook',
    resourceId: id
  })
  return {
    id,
    secret,
    endpoint: `/api/v1/webhooks/${id}`,
    warning: 'Webhook Secret 只显示一次，请立即保存。'
  }
})
