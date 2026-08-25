export default defineEventHandler(async (event) => {
  const env = useCloudflareEnv(event)
  const row = await env.DB.prepare(
    'SELECT COUNT(*) AS count FROM admins'
  ).first<{ count: number }>()

  return {
    setupRequired: Number(row?.count ?? 0) === 0,
    setupTokenConfigured: Boolean(useRuntimeSecrets(env).SETUP_TOKEN)
  }
})
