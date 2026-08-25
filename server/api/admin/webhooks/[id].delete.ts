export default defineEventHandler(async (event) => {
  const admin = await requireAdmin(event)
  const env = useCloudflareEnv(event)
  const id = getRouterParam(event, 'id')
  const now = new Date().toISOString()
  const result = await env.DB.prepare(`
    UPDATE webhooks SET active = 0, updated_at = ?
    WHERE id = ? AND active = 1
  `).bind(now, id).run()
  if (Number(result.meta.changes ?? 0) === 0) {
    throw createError({ statusCode: 404, statusMessage: 'Webhook not found' })
  }
  await writeAudit(env, {
    actorType: 'admin',
    actorId: admin.id,
    action: 'webhook.disable',
    resourceType: 'webhook',
    resourceId: id
  })
  return { disabled: true }
})
