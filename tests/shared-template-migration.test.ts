import { readFileSync } from 'node:fs'
import { DatabaseSync } from 'node:sqlite'
import { describe, expect, it } from 'vitest'

function migration(name: string): string {
  return readFileSync(
    new URL(`../migrations/${name}`, import.meta.url),
    'utf8'
  )
}

describe('shared template migration', () => {
  it('deduplicates domain templates and preserves webhook and job references', () => {
    const db = new DatabaseSync(':memory:')
    db.exec(migration('0001_initial.sql'))
    db.exec(migration('0002_users_and_scoped_keys.sql'))
    db.exec(migration('0003_normalize_template_newlines.sql'))

    const insertDomain = db.prepare(`
      INSERT INTO domains (
        id, zone_id, name, zone_status, sending_enabled,
        last_synced_at, created_at, updated_at
      )
      VALUES (?, ?, ?, 'active', 1, ?, ?, ?)
    `)
    for (const [id, name] of [
      ['domain-a', 'a.example.com'],
      ['domain-b', 'b.example.com']
    ]) {
      insertDomain.run(id, `zone-${id}`, name, '2026-07-28', '2026-07-28', '2026-07-28')
    }

    db.exec(migration('0004_default_english_templates.sql'))

    const copies = db.prepare(`
      SELECT id, domain_id
      FROM templates
      WHERE template_key = 'welcome_registration'
      ORDER BY domain_id
    `).all() as Array<{ id: string, domain_id: string }>
    expect(copies).toHaveLength(2)

    db.prepare(`
      INSERT INTO webhooks (
        id, domain_id, template_id, name, secret_prefix,
        secret_hash, active, created_at, updated_at
      )
      VALUES ('webhook-1', ?, ?, 'Welcome', 'whsec_example',
              'hash', 1, '2026-07-28', '2026-07-28')
    `).run(copies[0]!.domain_id, copies[0]!.id)

    db.prepare(`
      INSERT INTO send_jobs (
        id, domain_id, template_id, source, source_ref,
        recipients_to, from_email, subject, html_body, text_body,
        status, queued_at, updated_at
      )
      VALUES (
        'job-1', ?, ?, 'manual', 'admin-1',
        '["user@example.com"]', 'noreply@example.com',
        'Welcome', '<p>Welcome</p>', 'Welcome',
        'sent', '2026-07-28', '2026-07-28'
      )
    `).run(copies[1]!.domain_id, copies[1]!.id)

    db.exec(migration('0005_shared_templates_and_domain_config.sql'))

    const templateCount = db.prepare(
      'SELECT COUNT(*) AS count FROM templates'
    ).get() as { count: number }
    expect(templateCount.count).toBe(6)

    const references = db.prepare(`
      SELECT
        (SELECT template_key FROM templates
         JOIN webhooks ON webhooks.template_id = templates.id
         WHERE webhooks.id = 'webhook-1') AS webhook_template,
        (SELECT template_key FROM templates
         JOIN send_jobs ON send_jobs.template_id = templates.id
         WHERE send_jobs.id = 'job-1') AS job_template
    `).get() as { webhook_template: string, job_template: string }
    expect(references).toEqual({
      webhook_template: 'welcome_registration',
      job_template: 'welcome_registration'
    })

    const config = db.prepare(`
      SELECT template_config_json
      FROM domains
      WHERE id = 'domain-a'
    `).get() as { template_config_json: string }
    expect(config.template_config_json).toBe('{}')
    expect(db.prepare('PRAGMA foreign_key_check').all()).toEqual([])

    db.close()
  })
})
