import { templateSchema } from '../../../utils/template-schema'

export default defineEventHandler(async (event) => {
  const admin = await requireAdmin(event)
  const env = useCloudflareEnv(event)
  const body = parseInput(templateSchema, await readBody(event))
  const id = crypto.randomUUID()
  const now = new Date().toISOString()

  try {
    await env.DB.prepare(`
      INSERT INTO templates (
        id, template_key, name, description,
        subject_template, content_mode, html_template, text_template,
        from_local, from_name, reply_to, status, created_at, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      id,
      body.templateKey,
      body.name,
      body.description || null,
      body.subjectTemplate,
      body.contentMode,
      body.htmlTemplate,
      body.textTemplate || null,
      body.fromLocal || null,
      body.fromName || null,
      body.replyTo || null,
      body.status,
      now,
      now
    ).run()
  } catch (error) {
    if (error instanceof Error && error.message.includes('UNIQUE')) {
      throw createError({
        statusCode: 409,
        message: '共享模板库中已经存在相同的模板 Key。'
      })
    }
    throw error
  }

  await writeAudit(env, {
    actorType: 'admin',
    actorId: admin.id,
    action: 'template.create',
    resourceType: 'template',
    resourceId: id
  })
  return { id }
})
