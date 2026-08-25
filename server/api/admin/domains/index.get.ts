export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const env = useCloudflareEnv(event)
  const rows = await env.DB.prepare(`
    SELECT *
    FROM domains
    ORDER BY sending_enabled DESC, name ASC
  `).all<Record<string, unknown>>()

  return { domains: rows.results.map(mapDomain) }
})
