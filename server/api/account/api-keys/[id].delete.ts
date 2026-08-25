export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const env = useCloudflareEnv(event)
  const id = getRouterParam(event, 'id')
  const result = await env.DB.prepare(`
    UPDATE api_keys
    SET revoked_at = ?
    WHERE id = ? AND user_id = ? AND revoked_at IS NULL
  `).bind(new Date().toISOString(), id, user.id).run()
  if (Number(result.meta.changes ?? 0) === 0) {
    throw createError({ statusCode: 404, statusMessage: 'API key not found' })
  }
  await writeAudit(env, {
    actorType: 'user',
    actorId: user.id,
    action: 'api_key.revoke',
    resourceType: 'api_key',
    resourceId: id
  })
  return { revoked: true }
})
