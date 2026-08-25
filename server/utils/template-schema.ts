import { z } from 'zod'
import { EMAIL_LIMITS } from '../../shared/email-template'

export const templateSchema = z.object({
  templateKey: z.string().trim().min(2).max(100)
    .regex(/^[a-z0-9][a-z0-9_-]*$/, '模板 Key 仅支持小写字母、数字、下划线和连字符'),
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(500).optional().nullable(),
  subjectTemplate: z.string().trim().min(1).max(500),
  contentMode: z.literal('html').optional().default('html'),
  htmlTemplate: z.string().min(1).max(EMAIL_LIMITS.maxTemplateChars),
  textTemplate: z.null().optional(),
  fromLocal: z.union([
    z.string().trim().regex(/^[a-zA-Z0-9._+-]{1,64}$/),
    z.literal(''),
    z.null()
  ]).optional(),
  fromName: z.string().trim().max(120).optional().nullable(),
  replyTo: z.union([z.email(), z.literal(''), z.null()]).optional(),
  status: z.enum(['draft', 'active', 'archived'])
})
