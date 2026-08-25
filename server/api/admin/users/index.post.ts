import { z } from 'zod'
import { hashPassword } from '../../../utils/crypto'

const senderLocalSchema = z.string().trim().min(1).max(64)
  .regex(/^[a-zA-Z0-9._+-]+$/, '发件邮箱前缀包含不支持的字符')

const schema = z.object({
  username: z.string().trim().min(3).max(80)
    .regex(/^[a-zA-Z0-9._@+-]+$/, '用户名包含不支持的字符'),
  password: z.string().min(12).max(200),
  domainId: z.string().min(1).max(100),
  senderLocal: senderLocalSchema,
  senderName: z.string().trim().max(120).default('')
})

export default defineEventHandler(async (event) => {
  const admin = await requireAdmin(event)
  const env = useCloudflareEnv(event)
  const body = parseInput(schema, await readBody(event))
  const [domain, usernameTaken] = await Promise.all([
    env.DB.prepare(`
      SELECT id, name FROM domains
      WHERE id = ? AND sending_enabled = 1
    `).bind(body.domainId).first<{ id: string, name: string }>(),
    env.DB.prepare(`
      SELECT username FROM admins WHERE username = ?
      UNION ALL
      SELECT username FROM app_users WHERE username = ?
      LIMIT 1
    `).bind(body.username, body.username).first()
  ])

  if (!domain) {
    throw createError({
      statusCode: 409,
      message: '用户只能关联已启用 Cloudflare Email Sending 的域名。'
    })
  }
  if (usernameTaken) {
    throw createError({ statusCode: 409, message: '该用户名已存在。' })
  }

  const password = await hashPassword(body.password)
  const id = crypto.randomUUID()
  const now = new Date().toISOString()
  try {
    await env.DB.prepare(`
      INSERT INTO app_users (
        id, username, password_hash, password_salt, password_iterations,
        domain_id, sender_local, sender_name, active,
        created_by_admin_id, created_at, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?)
    `).bind(
      id,
      body.username,
      password.hash,
      password.salt,
      password.iterations,
      body.domainId,
      body.senderLocal,
      body.senderName,
      admin.id,
      now,
      now
    ).run()
  } catch (error) {
    if (error instanceof Error && error.message.includes('UNIQUE')) {
      throw createError({
        statusCode: 409,
        message: '该用户名或发件邮箱已经分配给其他用户。'
      })
    }
    throw error
  }

  await writeAudit(env, {
    actorType: 'admin',
    actorId: admin.id,
    action: 'user.create',
    resourceType: 'user',
    resourceId: id,
    metadata: { domainId: body.domainId, senderEmail: `${body.senderLocal}@${domain.name}` }
  })
  return { id, senderEmail: `${body.senderLocal}@${domain.name}` }
})
