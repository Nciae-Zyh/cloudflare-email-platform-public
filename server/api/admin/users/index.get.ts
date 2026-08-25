export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const env = useCloudflareEnv(event)
  const rows = await env.DB.prepare(`
    SELECT u.*, d.name AS domain_name, COUNT(k.id) AS api_key_count
    FROM app_users u
    JOIN domains d ON d.id = u.domain_id
    LEFT JOIN api_keys k ON k.user_id = u.id AND k.revoked_at IS NULL
    GROUP BY u.id
    ORDER BY u.created_at DESC
  `).all<Record<string, unknown>>()
  return { users: rows.results.map(mapUser) }
})
