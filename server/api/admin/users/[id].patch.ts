import { z } from 'zod'
import { hashPassword } from '../../../utils/crypto'

const schema = z.object({
  domainId: z.string().min(1).max(100).optional(),
  senderLocal: z.string().trim().min(1).max(64)
    .regex(/^[a-zA-Z0-9._+-]+$/).optional(),
  senderName: z.string().trim().max(120).optional(),
  password: z.string().min(12).max(200).optional(),
  active: z.boolean().optional()
}).refine(value => Object.keys(value).length > 0, '至少提供一个修改项')

export default defineEventHandler(async (event) => {
  const admin = await requireAdmin(event)
  const env = useCloudflareEnv(event)
  const id = getRouterParam(event, 'id')
  const body = parseInput(schema, await readBody(event))
  const current = await env.DB.prepare(`
    SELECT domain_id, sender_local FROM app_users WHERE id = ?
  `).bind(id).first<{ domain_id: string, sender_local: string }>()
  if (!current) throw createError({ statusCode: 404, statusMessage: 'User not found' })

  const domainId = body.domainId ?? current.domain_id
  const senderLocal = body.senderLocal ?? current.sender_local
  const domain = await env.DB.prepare(`
    SELECT id, name FROM domains WHERE id = ? AND sending_enabled = 1
  `).bind(domainId).first<{ id: string, name: string }>()
  if (!domain) {
    throw createError({
      statusCode: 409,
      message: '用户只能关联已启用 Cloudflare Email Sending 的域名。'
    })
  }

  const updates = [
    'domain_id = ?',
    'sender_local = ?',
    'updated_at = ?'
  ]
  const bindings: Array<string | number> = [
    domainId,
    senderLocal,
    new Date().toISOString()
  ]
  if (body.senderName !== undefined) {
    updates.push('sender_name = ?')
    bindings.push(body.senderName)
  }
  if (body.active !== undefined) {
    updates.push('active = ?')
    bindings.push(body.active ? 1 : 0)
  }
  if (body.password) {
    const password = await hashPassword(body.password)
    updates.push('password_hash = ?', 'password_salt = ?', 'password_iterations = ?')
    bindings.push(password.hash, password.salt, password.iterations)
  }

  try {
    await env.DB.prepare(`
      UPDATE app_users SET ${updates.join(', ')} WHERE id = ?
    `).bind(...bindings, id).run()
  } catch (error) {
    if (error instanceof Error && error.message.includes('UNIQUE')) {
      throw createError({ statusCode: 409, message: '该发件邮箱已经分配给其他用户。' })
    }
    throw error
  }

  if (body.active === false || body.password) {
    await env.DB.prepare('DELETE FROM user_sessions WHERE user_id = ?').bind(id).run()
  }
  await writeAudit(env, {
    actorType: 'admin',
    actorId: admin.id,
    action: 'user.update',
    resourceType: 'user',
    resourceId: id,
    metadata: {
      active: body.active,
      passwordReset: Boolean(body.password),
      senderEmail: `${senderLocal}@${domain.name}`
    }
  })
  return { updated: true, senderEmail: `${senderLocal}@${domain.name}` }
})
