import { z } from 'zod'
import { sendPayloadSchema } from '../../utils/email-job'

export default defineEventHandler(async (event) => {
  const admin = await requireAdmin(event)
  const env = useCloudflareEnv(event)
  const schema = sendPayloadSchema.extend({
    domainId: z.string().min(1).max(100)
  })
  const body = parseInput(schema, await readBody(event))

  const result = await createEmailJob(env, {
    domainId: body.domainId,
    source: 'manual',
    sourceRef: admin.id,
    allowDraftTemplate: true,
    payload: body
  })

  await writeAudit(env, {
    actorType: 'admin',
    actorId: admin.id,
    action: 'email.enqueue',
    resourceType: 'send_job',
    resourceId: result.jobId,
    metadata: { source: 'manual', duplicate: result.duplicate }
  })
  setResponseStatus(event, 202)
  return result
})
