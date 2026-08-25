export default defineEventHandler(async (event) => {
  const env = useCloudflareEnv(event)
  const [account, adminCount] = await Promise.all([
    getCurrentAccount(event),
    env.DB.prepare('SELECT COUNT(*) AS count FROM admins').first<{ count: number }>()
  ])

  return {
    authenticated: Boolean(account),
    account,
    setupRequired: Number(adminCount?.count ?? 0) === 0
  }
})
