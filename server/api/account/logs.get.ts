import { z } from 'zod'

const querySchema = z.object({
  status: z.enum(['queued', 'processing', 'retrying', 'sent', 'failed']).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50)
})

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const env = useCloudflareEnv(event)
  const query = parseInput(querySchema, getQuery(event))
  const statusClause = query.status ? 'AND j.status = ?' : ''
  const bindings: Array<string | number> = [user.id]
  if (query.status) bindings.push(query.status)
  bindings.push(query.limit)
  const rows = await env.DB.prepare(`
    SELECT j.*, d.name AS domain_name, t.name AS template_name,
           u.username
    FROM send_jobs j
    JOIN domains d ON d.id = j.domain_id
    LEFT JOIN templates t ON t.id = j.template_id
    LEFT JOIN app_users u ON u.id = j.user_id
    WHERE j.user_id = ? ${statusClause}
    ORDER BY j.queued_at DESC
    LIMIT ?
  `).bind(...bindings).all<Record<string, unknown>>()
  return { logs: rows.results.map(mapSendLog) }
})
