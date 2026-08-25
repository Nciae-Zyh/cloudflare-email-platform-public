export default defineNuxtRouteMiddleware(async (to) => {
  if (to.path === '/login' || to.path === '/setup') return
  const auth = useAuthState()
  if (!auth.value.loaded) await refreshAuthState()
  if (auth.value.setupRequired) return navigateTo('/setup')
  if (!auth.value.authenticated) return navigateTo('/login')

  const adminOnlyPaths = ['/domains', '/templates', '/integrations', '/users']
  if (
    auth.value.account?.role !== 'admin'
    && adminOnlyPaths.some(path => to.path === path || to.path.startsWith(`${path}/`))
  ) {
    return navigateTo('/send')
  }
  if (auth.value.account?.role === 'admin' && to.path.startsWith('/keys')) {
    return navigateTo('/integrations')
  }
})
