export default defineEventHandler(async (event) => {
  const account = await getCurrentAccount(event)
  const env = useCloudflareEnv(event)
  await logoutAccount(event)
  if (account) {
    await writeAudit(env, {
      actorType: account.role,
      actorId: account.id,
      action: 'auth.logout',
      resourceType: 'session'
    })
  }
  return { success: true }
})
