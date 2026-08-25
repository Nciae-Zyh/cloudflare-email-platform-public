import { sendPayloadSchema } from '../../utils/email-job'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const env = useCloudflareEnv(event)
  const body = parseInput(sendPayloadSchema, await readBody(event))
  const senderLocal = user.senderEmail!.slice(0, user.senderEmail!.lastIndexOf('@'))
  const result = await createEmailJob(env, {
    domainId: user.domainId!,
    userId: user.id,
    forceFromLocal: senderLocal,
    forceFromName: user.senderName,
    source: 'manual',
    sourceRef: user.id,
    payload: body
  })
  await writeAudit(env, {
    actorType: 'user',
    actorId: user.id,
    action: 'email.enqueue',
    resourceType: 'send_job',
    resourceId: result.jobId,
    metadata: {
      source: 'manual',
      senderEmail: user.senderEmail,
      duplicate: result.duplicate
    }
  })
  setResponseStatus(event, 202)
  return result
})
