import { describe, expect, it } from 'vitest'
import { templateSchema } from '../server/utils/template-schema'

const validTemplate = {
  templateKey: 'welcome',
  name: 'Welcome',
  subjectTemplate: 'Welcome {{user.name}}',
  htmlTemplate: '<h1>Welcome {{user.name}}</h1>',
  textTemplate: null,
  status: 'active'
}

describe('HTML-only template schema', () => {
  it('defaults templates to HTML', () => {
    expect(templateSchema.parse(validTemplate).contentMode).toBe('html')
  })

  it('rejects Markdown template writes', () => {
    expect(() => templateSchema.parse({
      ...validTemplate,
      contentMode: 'markdown'
    })).toThrow()
  })

  it('rejects manually configured plain-text bodies', () => {
    expect(() => templateSchema.parse({
      ...validTemplate,
      contentMode: 'html',
      textTemplate: 'manual text'
    })).toThrow()
  })
})
