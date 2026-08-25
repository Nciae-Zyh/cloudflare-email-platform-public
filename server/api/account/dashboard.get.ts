export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const env = useCloudflareEnv(event)
  const [templates, keys, jobs, recent] = await Promise.all([
    env.DB.prepare(`
      SELECT COUNT(*) AS total FROM templates
      WHERE status = 'active'
    `).first<Record<string, number>>(),
    env.DB.prepare(`
      SELECT COUNT(*) AS total FROM api_keys
      WHERE user_id = ? AND revoked_at IS NULL
    `).bind(user.id).first<Record<string, number>>(),
    env.DB.prepare(`
      SELECT COUNT(*) AS total,
             SUM(CASE WHEN status = 'sent' THEN 1 ELSE 0 END) AS sent,
             SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) AS failed,
             SUM(CASE WHEN status IN ('queued', 'processing', 'retrying') THEN 1 ELSE 0 END) AS pending
      FROM send_jobs
      WHERE user_id = ? AND queued_at >= datetime('now', '-7 days')
    `).bind(user.id).first<Record<string, number>>(),
    env.DB.prepare(`
      SELECT j.*, d.name AS domain_name, t.name AS template_name,
             u.username
      FROM send_jobs j
      JOIN domains d ON d.id = j.domain_id
      LEFT JOIN templates t ON t.id = j.template_id
      LEFT JOIN app_users u ON u.id = j.user_id
      WHERE j.user_id = ?
      ORDER BY j.queued_at DESC
      LIMIT 8
    `).bind(user.id).all<Record<string, unknown>>()
  ])
  return {
    stats: {
      domains: 1,
      sendingDomains: 1,
      templates: Number(templates?.total ?? 0),
      activeTemplates: Number(templates?.total ?? 0),
      apiKeys: Number(keys?.total ?? 0),
      sent7d: Number(jobs?.sent ?? 0),
      failed7d: Number(jobs?.failed ?? 0),
      pending: Number(jobs?.pending ?? 0)
    },
    recent: recent.results.map(mapSendLog)
  }
})
