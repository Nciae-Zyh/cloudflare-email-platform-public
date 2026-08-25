export default defineEventHandler(async (event) => {
  const admin = await requireAdmin(event)
  const env = useCloudflareEnv(event)
  const id = getRouterParam(event, 'id')
  const result = await env.DB.prepare(`
    UPDATE templates
    SET status = 'archived', updated_at = ?
    WHERE id = ?
  `).bind(new Date().toISOString(), id).run()
  if (Number(result.meta.changes ?? 0) === 0) {
    throw createError({ statusCode: 404, statusMessage: 'Template not found' })
  }
  await writeAudit(env, {
    actorType: 'admin',
    actorId: admin.id,
    action: 'template.archive',
    resourceType: 'template',
    resourceId: id
  })
  return { archived: true }
})
