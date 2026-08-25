import { z } from 'zod'

export const TEMPLATE_CONFIG_MAX_CHARS = 50_000

export const templateConfigSchema = z.record(
  z.string().trim().min(1).max(100),
  z.unknown()
).superRefine((value, context) => {
  if (JSON.stringify(value).length > TEMPLATE_CONFIG_MAX_CHARS) {
    context.addIssue({
      code: 'custom',
      message: '模板固定变量不能超过 50 KB。'
    })
  }
})

export function parseTemplateConfigJson(
  value: unknown
): Record<string, unknown> {
  if (typeof value !== 'string') return {}
  try {
    return templateConfigSchema.parse(JSON.parse(value))
  } catch {
    return {}
  }
}

export function mergeTemplateConfig(
  variables: Record<string, unknown>,
  config: Record<string, unknown>
): Record<string, unknown> {
  return {
    ...variables,
    config
  }
}
