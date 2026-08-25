import { templateSchema } from '../../../utils/template-schema'

export default defineEventHandler(async (event) => {
  const admin = await requireAdmin(event)
  const env = useCloudflareEnv(event)
  const id = getRouterParam(event, 'id')
  const body = parseInput(templateSchema, await readBody(event))
  const now = new Date().toISOString()

  try {
    const result = await env.DB.prepare(`
      UPDATE templates
      SET template_key = ?, name = ?, description = ?,
          subject_template = ?, content_mode = ?, html_template = ?,
          text_template = ?, from_local = ?, from_name = ?,
          reply_to = ?, status = ?, updated_at = ?
      WHERE id = ?
    `).bind(
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
      id
    ).run()
    if (Number(result.meta.changes ?? 0) === 0) {
      throw createError({ statusCode: 404, statusMessage: 'Template not found' })
    }
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
    action: 'template.update',
    resourceType: 'template',
    resourceId: id
  })
  return { updated: true }
})
