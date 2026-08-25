type RuntimeSecrets = {
  CF_API_TOKEN?: string
  SETUP_TOKEN?: string
  SESSION_TTL_SECONDS?: string
}

export function useRuntimeSecrets(env: CloudflareEnv): RuntimeSecrets {
  return env as CloudflareEnv & RuntimeSecrets
}
