export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const env = useCloudflareEnv(event)
  const rows = await env.DB.prepare(`
    SELECT k.*, d.name AS domain_name, u.username, u.sender_local
    FROM api_keys k
    JOIN domains d ON d.id = k.domain_id
    LEFT JOIN app_users u ON u.id = k.user_id
    ORDER BY k.created_at DESC
  `).all<Record<string, unknown>>()
  return { apiKeys: rows.results.map(mapApiKey) }
})
