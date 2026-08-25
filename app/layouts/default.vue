<script setup lang="ts">
import type { NavigationMenuItem } from '@nuxt/ui'

const route = useRoute()
const open = ref(false)
const auth = useAuthState()

const navigation = computed<NavigationMenuItem[]>(() => {
  const item = (label: string, icon: string, to: string): NavigationMenuItem => ({
    label,
    icon,
    to,
    active: route.path === to || (to !== '/' && route.path.startsWith(`${to}/`)),
    onSelect: () => open.value = false
  })
  if (auth.value.account?.role === 'user') {
    return [
      item('概览', 'i-lucide-layout-dashboard', '/'),
      item('手动发送', 'i-lucide-send', '/send'),
      item('我的 API Keys', 'i-lucide-key-round', '/keys'),
      item('发送日志', 'i-lucide-scroll-text', '/logs')
    ]
  }
  return [
    item('概览', 'i-lucide-layout-dashboard', '/'),
    item('域名', 'i-lucide-globe-2', '/domains'),
    item('用户与邮箱', 'i-lucide-users', '/users'),
    item('邮件模板', 'i-lucide-panels-top-left', '/templates'),
    item('手动发送', 'i-lucide-send', '/send'),
    item('API 与 Webhook', 'i-lucide-webhook', '/integrations'),
    item('发送日志', 'i-lucide-scroll-text', '/logs')
  ]
})

async function logout() {
  await $fetch('/api/auth/logout', { method: 'POST' })
  auth.value = { loaded: true, authenticated: false, account: null, setupRequired: false }
  await navigateTo('/login')
}
</script>

<template>
  <UDashboardGroup unit="rem">
    <UDashboardSidebar
      id="cloudmail-sidebar"
      v-model:open="open"
      collapsible
      resizable
      class="bg-elevated/40"
    >
      <template #header="{ collapsed }">
        <NuxtLink to="/" class="flex items-center gap-3 overflow-hidden">
          <span class="grid size-9 shrink-0 place-items-center rounded-xl bg-primary text-inverted">
            <UIcon name="i-lucide-cloud-lightning" class="size-5" />
          </span>
          <div v-if="!collapsed" class="min-w-0">
            <p class="truncate font-semibold text-highlighted">CloudMail</p>
            <p class="truncate text-xs text-muted">Email Platform</p>
          </div>
        </NuxtLink>
      </template>

      <template #default="{ collapsed }">
        <UNavigationMenu
          :collapsed="collapsed"
          :items="navigation"
          orientation="vertical"
          tooltip
          popover
        />

        <UCard v-if="!collapsed" class="mt-auto bg-accented/40">
          <div class="flex items-start gap-3">
            <UIcon name="i-lucide-shield-check" class="mt-0.5 size-5 text-success" />
            <div>
              <p class="text-sm font-medium">
                事务型邮件
              </p>
              <p class="mt-1 text-xs leading-5 text-muted">
                {{ auth.account?.role === 'user'
                  ? '发送地址与 API Key 均锁定到你的专属邮箱。'
                  : '用户、邮箱和 API Key 分层隔离，任务经 Queue 异步处理。' }}
              </p>
            </div>
          </div>
        </UCard>
      </template>

      <template #footer="{ collapsed }">
        <div class="flex items-center gap-2">
          <UAvatar
            :alt="auth.account?.username || 'Account'"
            size="sm"
            class="shrink-0"
          />
          <div v-if="!collapsed" class="min-w-0 flex-1">
            <p class="truncate text-sm font-medium">
              {{ auth.account?.username }}
            </p>
            <p class="text-xs text-muted">
              {{ auth.account?.role === 'admin' ? '管理员' : auth.account?.senderEmail }}
            </p>
          </div>
          <UButton
            v-if="!collapsed"
            icon="i-lucide-log-out"
            color="neutral"
            variant="ghost"
            aria-label="退出登录"
            @click="logout"
          />
        </div>
      </template>
    </UDashboardSidebar>

    <slot />
  </UDashboardGroup>
</template>
