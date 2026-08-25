import { getHeader } from 'h3'
import { z } from 'zod'
import { sha256Base64Url } from '../../utils/crypto'

const schema = z.object({
  username: z.string().trim().min(1).max(80),
  password: z.string().min(1).max(200)
})

export default defineEventHandler(async (event) => {
  const env = useCloudflareEnv(event)
  const body = parseInput(schema, await readBody(event))
  const ip = getHeader(event, 'cf-connecting-ip')
    || getHeader(event, 'x-forwarded-for')
    || 'unknown'
  const attemptKey = await sha256Base64Url(`${body.username.toLowerCase()}:${ip}`)
  const cutoff = new Date(Date.now() - 15 * 60 * 1000).toISOString()

  const attempts = await env.DB.prepare(`
    SELECT COUNT(*) AS count
    FROM login_attempts
    WHERE key_hash = ? AND attempted_at > ?
  `).bind(attemptKey, cutoff).first<{ count: number }>()

  if (Number(attempts?.count ?? 0) >= 5) {
    throw createError({
      statusCode: 429,
      message: '登录失败次数过多，请 15 分钟后重试。'
    })
  }

  const account = await loginAccount(event, body.username, body.password)
  if (!account) {
    await env.DB.prepare(`
      INSERT INTO login_attempts (id, key_hash, attempted_at)
      VALUES (?, ?, ?)
    `).bind(crypto.randomUUID(), attemptKey, new Date().toISOString()).run()
    throw createError({
      statusCode: 401,
      message: '用户名或密码错误。'
    })
  }

  await env.DB.batch([
    env.DB.prepare('DELETE FROM login_attempts WHERE key_hash = ?').bind(attemptKey),
    env.DB.prepare('DELETE FROM login_attempts WHERE attempted_at <= ?').bind(cutoff)
  ])
  await writeAudit(env, {
    actorType: account.role,
    actorId: account.id,
    action: 'auth.login',
    resourceType: 'session'
  })

  return { account }
})
