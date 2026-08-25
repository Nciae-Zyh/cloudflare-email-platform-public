import { readFileSync } from 'node:fs'
import { describe, expect, it, vi } from 'vitest'
import { ensureDefaultEnglishTemplates } from '../server/utils/default-templates'

const migration = readFileSync(
  new URL('../migrations/0004_default_english_templates.sql', import.meta.url),
  'utf8'
)

describe('default English email templates', () => {
  it('defines the expected English-only template package', () => {
    const seedSection = migration.match(
      /INSERT INTO default_email_templates[\s\S]+?;\n\nUPDATE templates/
    )?.[0] ?? ''
    const keys = [...seedSection.matchAll(/^\s{4}'([a-z_]+)',$/gm)]
      .map(match => match[1])

    expect(keys).toEqual([
      'email_verification_code',
      'welcome_registration',
      'sign_in_code',
      'password_reset',
      'password_changed',
      'account_invitation'
    ])
    expect(seedSection).not.toMatch(/[\u3400-\u9fff]/u)
  })

  it('only inserts missing templates into the shared template library', async () => {
    const run = vi.fn().mockResolvedValue({ meta: { changes: 6 } })
    const bind = vi.fn().mockReturnValue({ run })
    const prepare = vi.fn().mockReturnValue({ bind })

    const created = await ensureDefaultEnglishTemplates({
      DB: { prepare }
    } as unknown as CloudflareEnv)

    expect(created).toBe(6)
    expect(prepare).toHaveBeenCalledOnce()
    expect(prepare.mock.calls[0]?.[0]).not.toContain('FROM domains')
    expect(prepare.mock.calls[0]?.[0]).toContain(
      'ON CONFLICT(template_key) DO NOTHING'
    )
    expect(prepare.mock.calls[0]?.[0]).toContain(
      '\'html\',\n      defaults.html_template'
    )
    expect(bind).toHaveBeenCalledOnce()
    expect(run).toHaveBeenCalledOnce()
  })
})
