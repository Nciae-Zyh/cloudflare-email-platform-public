import { z } from 'zod'
import { timingSafeSecretEqual, hashPassword } from '../../utils/crypto'
import { ensureDefaultEnglishTemplates } from '../../utils/default-templates'

const schema = z.object({
  setupToken: z.string().trim().min(16).max(300),
  username: z.string().trim().min(3).max(80)
    .regex(/^[a-zA-Z0-9._@+-]+$/, '用户名包含不支持的字符'),
  password: z.string().min(12).max(200)
})

export default defineEventHandler(async (event) => {
  const env = useCloudflareEnv(event)
  const expectedToken = useRuntimeSecrets(env).SETUP_TOKEN?.trim()
  if (!expectedToken) {
    throw createError({
      statusCode: 503,
      message: '生产环境尚未配置 SETUP_TOKEN。'
    })
  }

  const body = parseInput(schema, await readBody(event))
  if (!await timingSafeSecretEqual(body.setupToken, expectedToken)) {
    throw createError({
      statusCode: 403,
      statusMessage: 'Invalid setup token'
    })
  }

  const count = await env.DB.prepare(
    'SELECT COUNT(*) AS count FROM admins'
  ).first<{ count: number }>()
  if (Number(count?.count ?? 0) > 0) {
    throw createError({
      statusCode: 409,
      message: '管理员已创建，初始化入口已经关闭。'
    })
  }

  await ensureDefaultEnglishTemplates(env)
  const password = await hashPassword(body.password)
  const adminId = crypto.randomUUID()
  const now = new Date().toISOString()
  await env.DB.prepare(`
    INSERT INTO admins
      (id, username, password_hash, password_salt, password_iterations, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).bind(
    adminId,
    body.username,
    password.hash,
    password.salt,
    password.iterations,
    now
  ).run()

  await writeAudit(env, {
    actorType: 'system',
    action: 'admin.bootstrap',
    resourceType: 'admin',
    resourceId: adminId
  })

  return { created: true }
})
