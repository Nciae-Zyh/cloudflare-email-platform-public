import { getHeader } from 'h3'
import { sendPayloadSchema } from '../../utils/email-job'

export default defineEventHandler(async (event) => {
  const env = useCloudflareEnv(event)
  const apiKey = await authenticateApiKey(event, env)
  const body = parseInput(sendPayloadSchema, await readBody(event))
  const idempotencyKey = getHeader(event, 'idempotency-key') || body.idempotency_key
  const result = await createEmailJob(env, {
    domainId: apiKey.domainId,
    userId: apiKey.userId,
    forceFromLocal: apiKey.senderLocal ?? undefined,
    forceFromName: apiKey.senderName,
    source: 'rest',
    sourceRef: apiKey.id,
    payload: { ...body, idempotency_key: idempotencyKey }
  })

  await writeAudit(env, {
    actorType: 'api_key',
    actorId: apiKey.id,
    action: 'email.enqueue',
    resourceType: 'send_job',
    resourceId: result.jobId,
    metadata: {
      source: 'rest',
      userId: apiKey.userId,
      senderEmail: apiKey.senderLocal
        ? `${apiKey.senderLocal}@${apiKey.domainName}`
        : null,
      duplicate: result.duplicate
    }
  })
  setResponseStatus(event, result.duplicate ? 200 : 202)
  return result
})
