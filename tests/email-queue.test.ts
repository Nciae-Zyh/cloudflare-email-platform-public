import { describe, expect, it, vi } from 'vitest'
import type { EmailQueueMessage } from '../shared/types'
import { processEmailQueueBatch } from '../server/utils/email-queue'

function createMessage(jobId: string) {
  return {
    body: { jobId },
    ack: vi.fn(),
    retry: vi.fn()
  }
}

describe('email queue batch consumer', () => {
  it('acknowledges completed jobs and schedules transient retries', async () => {
    const first = createMessage('job-1')
    const second = createMessage('job-2')
    const processJob = vi.fn()
      .mockResolvedValueOnce({ action: 'ack' })
      .mockResolvedValueOnce({ action: 'retry', delaySeconds: 45 })
    const log = vi.spyOn(console, 'log').mockImplementation(() => {})

    await processEmailQueueBatch(
      { messages: [first, second] } as unknown as MessageBatch<EmailQueueMessage>,
      {} as CloudflareEnv,
      processJob
    )

    expect(processJob).toHaveBeenNthCalledWith(1, first.body, expect.anything())
    expect(processJob).toHaveBeenNthCalledWith(2, second.body, expect.anything())
    expect(first.ack).toHaveBeenCalledOnce()
    expect(first.retry).not.toHaveBeenCalled()
    expect(second.ack).not.toHaveBeenCalled()
    expect(second.retry).toHaveBeenCalledWith({ delaySeconds: 45 })
    expect(log).toHaveBeenCalledWith(expect.stringContaining('cloudmail-queue-consumer-v1'))

    log.mockRestore()
  })

  it('rejects the batch when processing unexpectedly throws', async () => {
    const message = createMessage('job-1')
    const log = vi.spyOn(console, 'log').mockImplementation(() => {})

    await expect(processEmailQueueBatch(
      { messages: [message] } as unknown as MessageBatch<EmailQueueMessage>,
      {} as CloudflareEnv,
      async () => {
        throw new Error('unexpected')
      }
    )).rejects.toThrow('unexpected')

    expect(message.ack).not.toHaveBeenCalled()
    expect(message.retry).not.toHaveBeenCalled()

    log.mockRestore()
  })
})
