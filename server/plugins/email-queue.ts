import type { EmailQueueMessage } from '../../shared/types'
import { processEmailQueueBatch } from '../utils/email-queue'

export default defineNitroPlugin((nitroApp) => {
  nitroApp.hooks.hook('cloudflare:queue', async ({ batch, env }) => {
    await processEmailQueueBatch(
      batch as MessageBatch<EmailQueueMessage>,
      env as CloudflareEnv
    )
  })
})
