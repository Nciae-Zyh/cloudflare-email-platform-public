export default defineEventHandler(async (event) => {
  const env = useCloudflareEnv(event)
  const database = await env.DB.prepare('SELECT 1 AS ok').first<{ ok: number }>()
  return {
    status: database?.ok === 1 ? 'ok' : 'degraded',
    service: 'CloudMail Platform',
    timestamp: new Date().toISOString()
  }
})
