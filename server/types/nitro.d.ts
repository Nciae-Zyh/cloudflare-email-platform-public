import type { ExecutionContext } from '@cloudflare/workers-types'

declare module 'h3' {
  interface H3EventContext {
    cloudflare?: {
      env: CloudflareEnv
      context: ExecutionContext
    }
  }
}

declare module '*.mjs' {
  const worker: ExportedHandler<CloudflareEnv>
  export default worker
}

export {}
