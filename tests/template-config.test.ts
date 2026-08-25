import { describe, expect, it } from 'vitest'
import {
  mergeTemplateConfig,
  parseTemplateConfigJson,
  templateConfigSchema
} from '../server/utils/template-config'

describe('template fixed configuration', () => {
  it('parses nested link configuration', () => {
    expect(parseTemplateConfigJson(
      '{"links":{"login":"https://example.com/login"}}'
    )).toEqual({
      links: {
        login: 'https://example.com/login'
      }
    })
  })

  it('returns an empty object for invalid stored JSON', () => {
    expect(parseTemplateConfigJson('[]')).toEqual({})
    expect(parseTemplateConfigJson('{')).toEqual({})
  })

  it('prevents request variables from overriding fixed config', () => {
    expect(mergeTemplateConfig(
      {
        user: { name: 'Example' },
        config: { links: { login: 'https://attacker.invalid' } }
      },
      { links: { login: 'https://example.com/login' } }
    )).toEqual({
      user: { name: 'Example' },
      config: { links: { login: 'https://example.com/login' } }
    })
  })

  it('limits serialized configuration size', () => {
    expect(() => templateConfigSchema.parse({
      value: 'x'.repeat(50_001)
    })).toThrow('模板固定变量不能超过 50 KB')
  })
})
