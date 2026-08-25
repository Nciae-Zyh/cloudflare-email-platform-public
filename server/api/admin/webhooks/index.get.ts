export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const env = useCloudflareEnv(event)
  const rows = await env.DB.prepare(`
    SELECT w.*, d.name AS domain_name, t.name AS template_name
    FROM webhooks w
    JOIN domains d ON d.id = w.domain_id
    JOIN templates t ON t.id = w.template_id
    ORDER BY w.created_at DESC
  `).all<Record<string, unknown>>()
  return { webhooks: rows.results.map(mapWebhook) }
})
