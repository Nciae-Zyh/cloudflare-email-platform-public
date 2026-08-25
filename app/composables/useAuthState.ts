import type { AccountRecord } from '#shared/types'

type AuthState = {
  loaded: boolean
  authenticated: boolean
  account: AccountRecord | null
  setupRequired: boolean
}

export function useAuthState() {
  return useState<AuthState>('cloudmail-auth', () => ({
    loaded: false,
    authenticated: false,
    account: null,
    setupRequired: false
  }))
}

export async function refreshAuthState() {
  const state = useAuthState()
  try {
    const requestFetch = import.meta.server ? useRequestFetch() : $fetch
    const result = await requestFetch('/api/auth/me') as {
      authenticated: boolean
      account: AccountRecord | null
      setupRequired: boolean
    }
    state.value = { loaded: true, ...result }
  } catch {
    state.value = {
      loaded: true,
      authenticated: false,
      account: null,
      setupRequired: false
    }
  }
  return state.value
}
