export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const env = useCloudflareEnv(event)
  const id = getRouterParam(event, 'id')
  const row = await env.DB.prepare(`
    SELECT *
    FROM templates
    WHERE id = ?
  `).bind(id).first<Record<string, unknown>>()
  if (!row) throw createError({ statusCode: 404, statusMessage: 'Template not found' })
  return { template: mapTemplate(row) }
})
