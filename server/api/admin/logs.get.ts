import { z } from 'zod'

const querySchema = z.object({
  status: z.enum(['queued', 'processing', 'retrying', 'sent', 'failed']).optional(),
  domainId: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50)
})

export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const env = useCloudflareEnv(event)
  const query = parseInput(querySchema, getQuery(event))
  const clauses: string[] = []
  const bindings: Array<string | number> = []

  if (query.status) {
    clauses.push('j.status = ?')
    bindings.push(query.status)
  }
  if (query.domainId) {
    clauses.push('j.domain_id = ?')
    bindings.push(query.domainId)
  }

  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : ''
  const rows = await env.DB.prepare(`
    SELECT j.*, d.name AS domain_name, t.name AS template_name,
           u.username
    FROM send_jobs j
    JOIN domains d ON d.id = j.domain_id
    LEFT JOIN templates t ON t.id = j.template_id
    LEFT JOIN app_users u ON u.id = j.user_id
    ${where}
    ORDER BY j.queued_at DESC
    LIMIT ?
  `).bind(...bindings, query.limit).all<Record<string, unknown>>()

  return { logs: rows.results.map(mapSendLog) }
})
