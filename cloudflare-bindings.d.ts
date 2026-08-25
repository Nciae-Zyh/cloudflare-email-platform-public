import type {
  D1Database,
  Fetcher,
  Queue,
  SendEmail
} from '@cloudflare/workers-types'

declare global {
  interface CloudflareEnv {
    DB: D1Database
    EMAIL: SendEmail
    EMAIL_QUEUE: Queue
    ASSETS: Fetcher
  }
}

export {}
