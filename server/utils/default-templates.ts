export async function ensureDefaultEnglishTemplates(
  env: CloudflareEnv
): Promise<number> {
  const now = new Date().toISOString()
  const result = await env.DB.prepare(`
    INSERT INTO templates (
      id, template_key, name, description,
      subject_template, content_mode, html_template, text_template,
      from_local, from_name, reply_to, status, created_at, updated_at
    )
    SELECT
      lower(hex(randomblob(16))),
      defaults.template_key,
      defaults.name,
      defaults.description,
      defaults.subject_template,
      'html',
      defaults.html_template,
      NULL,
      NULL,
      NULL,
      NULL,
      'active',
      ?,
      ?
    FROM default_email_templates AS defaults
    WHERE true
    ON CONFLICT(template_key) DO NOTHING
  `).bind(now, now).run()

  return Number(result.meta.changes ?? 0)
}
