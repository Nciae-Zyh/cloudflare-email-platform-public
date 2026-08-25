import { z } from 'zod'
import { ensureDefaultEnglishTemplates } from './default-templates'

const zoneSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  status: z.string().default('unknown')
})

const sendingDomainSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  enabled: z.boolean().default(false),
  preview_enabled: z.boolean().default(false),
  return_path_domain: z.string().nullable().optional(),
  dkim_selector: z.string().nullable().optional()
})

const envelopeSchema = <T extends z.ZodType>(resultSchema: T) => z.object({
  success: z.boolean(),
  result: resultSchema,
  errors: z.array(z.object({
    code: z.number().optional(),
    message: z.string()
  })).default([]),
  result_info: z.object({
    page: z.number().int().positive().default(1),
    total_pages: z.number().int().positive().default(1)
  }).optional()
})

type SyncedDomain = {
  zoneId: string
  name: string
  zoneStatus: string
  sendingEnabled: boolean
  sendingDomainId: string | null
  previewEnabled: boolean
  returnPathDomain: string | null
  dkimSelector: string | null
}

async function cloudflareRequest<T>(
  path: string,
  token: string,
  schema: z.ZodType<T>
): Promise<T> {
  const response = await fetch(`https://api.cloudflare.com/client/v4${path}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json'
    }
  })

  if (!response.ok) {
    throw createError({
      statusCode: 502,
      statusMessage: 'Cloudflare API error',
      message: `Cloudflare API 返回 ${response.status}。请检查令牌权限。`
    })
  }

  const contentLength = Number(response.headers.get('content-length') ?? 0)
  if (contentLength > 2_000_000) {
    throw createError({
      statusCode: 502,
      statusMessage: 'Cloudflare API response too large'
    })
  }

  return schema.parse(await response.json())
}

export async function syncCloudflareDomains(env: CloudflareEnv): Promise<{
  domainCount: number
  sendingEnabledCount: number
  defaultTemplatesCreated: number
}> {
  const token = useRuntimeSecrets(env).CF_API_TOKEN?.trim()
  if (!token) {
    throw createError({
      statusCode: 409,
      statusMessage: 'Cloudflare token not configured',
      message: '请先在 Cloudflare Worker 的 Variables and Secrets 中配置只读 CF_API_TOKEN。'
    })
  }

  const zones: z.infer<typeof zoneSchema>[] = []
  let page = 1

  while (true) {
    const zoneEnvelope = await cloudflareRequest(
      `/zones?status=active&per_page=50&page=${page}`,
      token,
      envelopeSchema(z.array(zoneSchema))
    )
    if (!zoneEnvelope.success) {
      throw createError({
        statusCode: 502,
        message: zoneEnvelope.errors.map(error => error.message).join('; ') || '读取域名失败'
      })
    }

    zones.push(...zoneEnvelope.result)
    const totalPages = zoneEnvelope.result_info?.total_pages ?? 1
    if (page >= totalPages) {
      break
    }
    page += 1
  }

  const synced = new Map<string, SyncedDomain>()
  for (const zone of zones) {
    const sendingEnvelope = await cloudflareRequest(
      `/zones/${zone.id}/email/sending/subdomains`,
      token,
      envelopeSchema(z.array(sendingDomainSchema))
    )
    const sendingDomains = sendingEnvelope.success ? sendingEnvelope.result : []

    synced.set(zone.name, {
      zoneId: zone.id,
      name: zone.name,
      zoneStatus: zone.status,
      sendingEnabled: false,
      sendingDomainId: null,
      previewEnabled: false,
      returnPathDomain: null,
      dkimSelector: null
    })

    for (const sending of sendingDomains) {
      synced.set(sending.name, {
        zoneId: zone.id,
        name: sending.name,
        zoneStatus: zone.status,
        sendingEnabled: sending.enabled,
        sendingDomainId: sending.id,
        previewEnabled: sending.preview_enabled,
        returnPathDomain: sending.return_path_domain ?? null,
        dkimSelector: sending.dkim_selector ?? null
      })
    }
  }

  const now = new Date().toISOString()
  const statements = [
    env.DB.prepare(`
      UPDATE domains
      SET zone_status = 'missing',
          sending_enabled = 0,
          updated_at = ?
    `).bind(now)
  ]

  for (const domain of synced.values()) {
    statements.push(env.DB.prepare(`
      INSERT INTO domains (
        id, zone_id, name, zone_status, sending_enabled, sending_domain_id,
        preview_enabled, return_path_domain, dkim_selector,
        last_synced_at, created_at, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(name) DO UPDATE SET
        zone_id = excluded.zone_id,
        zone_status = excluded.zone_status,
        sending_enabled = excluded.sending_enabled,
        sending_domain_id = excluded.sending_domain_id,
        preview_enabled = excluded.preview_enabled,
        return_path_domain = excluded.return_path_domain,
        dkim_selector = excluded.dkim_selector,
        last_synced_at = excluded.last_synced_at,
        updated_at = excluded.updated_at
    `).bind(
      crypto.randomUUID(),
      domain.zoneId,
      domain.name,
      domain.zoneStatus,
      domain.sendingEnabled ? 1 : 0,
      domain.sendingDomainId,
      domain.previewEnabled ? 1 : 0,
      domain.returnPathDomain,
      domain.dkimSelector,
      now,
      now,
      now
    ))
  }

  await env.DB.batch(statements)
  const defaultTemplatesCreated = await ensureDefaultEnglishTemplates(env)

  const values = [...synced.values()]
  return {
    domainCount: values.length,
    sendingEnabledCount: values.filter(domain => domain.sendingEnabled).length,
    defaultTemplatesCreated
  }
}
