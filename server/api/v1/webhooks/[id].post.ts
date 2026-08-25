import { getHeader } from 'h3'
import { sendPayloadSchema } from '../../../utils/email-job'

export default defineEventHandler(async (event) => {
  const env = useCloudflareEnv(event)
  const webhookId = getRouterParam(event, 'id')
  if (!webhookId) throw createError({ statusCode: 404 })
  const webhook = await authenticateWebhook(event, env, webhookId)
  const schema = sendPayloadSchema.omit({ template_key: true, template_id: true })
  const body = parseInput(schema, await readBody(event))
  const idempotencyKey = getHeader(event, 'idempotency-key') || body.idempotency_key
  const result = await createEmailJob(env, {
    domainId: webhook.domainId,
    source: 'webhook',
    sourceRef: webhook.id,
    payload: {
      ...body,
      template_id: webhook.templateId,
      idempotency_key: idempotencyKey
    }
  })

  await writeAudit(env, {
    actorType: 'webhook',
    actorId: webhook.id,
    action: 'email.enqueue',
    resourceType: 'send_job',
    resourceId: result.jobId,
    metadata: { source: 'webhook', duplicate: result.duplicate }
  })
  setResponseStatus(event, result.duplicate ? 200 : 202)
  return result
})
