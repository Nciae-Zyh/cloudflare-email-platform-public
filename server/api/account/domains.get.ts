export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const env = useCloudflareEnv(event)
  const row = await env.DB.prepare(`
    SELECT * FROM domains WHERE id = ?
  `).bind(user.domainId).first<Record<string, unknown>>()
  return { domains: row ? [mapDomain(row)] : [] }
})
