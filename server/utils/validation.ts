import type { z } from 'zod'

export function parseInput<T extends z.ZodType>(
  schema: T,
  value: unknown
): z.output<T> {
  const result = schema.safeParse(value)
  if (result.success) return result.data

  const message = result.error.issues.slice(0, 10).map((issue) => {
    const field = issue.path.length ? issue.path.join('.') : 'request'
    return `${field}: ${issue.message}`
  }).join('; ')
  throw createError({
    statusCode: 400,
    statusMessage: 'Invalid request',
    message
  })
}
