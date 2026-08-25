export async function writeAudit(
  env: CloudflareEnv,
  input: {
    actorType: 'admin' | 'user' | 'api_key' | 'webhook' | 'system'
    actorId?: string | null
    action: string
    resourceType: string
    resourceId?: string | null
    metadata?: Record<string, unknown>
  }
): Promise<void> {
  await env.DB.prepare(`
    INSERT INTO audit_logs
      (id, actor_type, actor_id, action, resource_type, resource_id, metadata_json, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    crypto.randomUUID(),
    input.actorType,
    input.actorId ?? null,
    input.action,
    input.resourceType,
    input.resourceId ?? null,
    JSON.stringify(input.metadata ?? {}),
    new Date().toISOString()
  ).run()
}
