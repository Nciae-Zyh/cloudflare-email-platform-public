import { z } from 'zod'
import { createSecret, sha256Base64Url } from '../../../utils/crypto'

const schema = z.object({
  name: z.string().trim().min(1).max(120)
})

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const env = useCloudflareEnv(event)
  const body = parseInput(schema, await readBody(event))
  const secret = createSecret('cmp_live_')
  const prefix = secret.slice(0, 16)
  const id = crypto.randomUUID()
  await env.DB.prepare(`
    INSERT INTO api_keys
      (id, domain_id, user_id, name, key_prefix, secret_hash, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).bind(
    id,
    user.domainId,
    user.id,
    body.name,
    prefix,
    await sha256Base64Url(secret),
    new Date().toISOString()
  ).run()
  await writeAudit(env, {
    actorType: 'user',
    actorId: user.id,
    action: 'api_key.create',
    resourceType: 'api_key',
    resourceId: id,
    metadata: { domainId: user.domainId, senderEmail: user.senderEmail, prefix }
  })
  return {
    id,
    key: secret,
    warning: 'API Key 只显示一次，请立即保存。'
  }
})
