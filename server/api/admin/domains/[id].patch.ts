import { z } from 'zod'

const schema = z.object({
  defaultFromLocal: z.string().trim().min(1).max(64)
    .regex(/^[a-zA-Z0-9._+-]+$/),
  defaultFromName: z.string().trim().min(1).max(120),
  defaultReplyTo: z.union([z.email(), z.literal(''), z.null()]).optional(),
  templateConfig: templateConfigSchema
})

export default defineEventHandler(async (event) => {
  const admin = await requireAdmin(event)
  const env = useCloudflareEnv(event)
  const id = getRouterParam(event, 'id')
  const body = parseInput(schema, await readBody(event))
  const now = new Date().toISOString()
  const result = await env.DB.prepare(`
    UPDATE domains
    SET default_from_local = ?,
        default_from_name = ?,
        default_reply_to = ?,
        template_config_json = ?,
        updated_at = ?
    WHERE id = ?
  `).bind(
    body.defaultFromLocal,
    body.defaultFromName,
    body.defaultReplyTo || null,
    JSON.stringify(body.templateConfig),
    now,
    id
  ).run()

  if (Number(result.meta.changes ?? 0) === 0) {
    throw createError({ statusCode: 404, statusMessage: 'Domain not found' })
  }
  await writeAudit(env, {
    actorType: 'admin',
    actorId: admin.id,
    action: 'domain.update',
    resourceType: 'domain',
    resourceId: id
  })
  return { updated: true }
})
