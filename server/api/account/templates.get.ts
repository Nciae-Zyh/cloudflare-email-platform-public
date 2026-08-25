export default defineEventHandler(async (event) => {
  await requireUser(event)
  const env = useCloudflareEnv(event)
  const rows = await env.DB.prepare(`
    SELECT *
    FROM templates
    WHERE status = 'active'
    ORDER BY updated_at DESC
  `).all<Record<string, unknown>>()
  return { templates: rows.results.map(mapTemplate) }
})
