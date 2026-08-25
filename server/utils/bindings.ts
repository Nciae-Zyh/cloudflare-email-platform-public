import type { H3Event } from 'h3'

export function useCloudflareEnv(event: H3Event): CloudflareEnv {
  const env = event.context.cloudflare?.env

  if (!env) {
    throw createError({
      statusCode: 503,
      statusMessage: 'Cloudflare bindings unavailable',
      message: '请使用 pnpm worker:dev 或部署后的 Cloudflare Worker 访问此功能。'
    })
  }

  return env
}
