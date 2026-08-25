export default defineEventHandler(async (event) => {
  const admin = await requireAdmin(event)
  const env = useCloudflareEnv(event)
  const result = await syncCloudflareDomains(env)
  await writeAudit(env, {
    actorType: 'admin',
    actorId: admin.id,
    action: 'domains.sync',
    resourceType: 'domain',
    metadata: result
  })
  return result
})
