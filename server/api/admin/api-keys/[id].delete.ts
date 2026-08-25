export default defineEventHandler(async (event) => {
  const admin = await requireAdmin(event)
  const env = useCloudflareEnv(event)
  const id = getRouterParam(event, 'id')
  const now = new Date().toISOString()
  const result = await env.DB.prepare(`
    UPDATE api_keys SET revoked_at = ? WHERE id = ? AND revoked_at IS NULL
  `).bind(now, id).run()
  if (Number(result.meta.changes ?? 0) === 0) {
    throw createError({ statusCode: 404, statusMessage: 'API key not found' })
  }
  await writeAudit(env, {
    actorType: 'admin',
    actorId: admin.id,
    action: 'api_key.revoke',
    resourceType: 'api_key',
    resourceId: id
  })
  return { revoked: true }
})
