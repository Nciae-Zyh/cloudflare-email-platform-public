<script setup lang="ts">
import type { SendLogRecord } from '#shared/types'

const auth = useAuthState()
const isAdmin = computed(() => auth.value.account?.role === 'admin')
const dashboardEndpoint = isAdmin.value ? '/api/admin/dashboard' : '/api/account/dashboard'
const { data, status, refresh } = await useFetch<{
  stats: {
    domains: number
    sendingDomains: number
    templates: number
    activeTemplates: number
    apiKeys?: number
    sent7d: number
    failed7d: number
    pending: number
  }
  recent: SendLogRecord[]
}>(dashboardEndpoint)

const cards = computed(() => {
  const stats = data.value?.stats
  if (!isAdmin.value) {
    return [{
      label: '专属发件邮箱',
      value: auth.value.account?.senderEmail ?? '—',
      icon: 'i-lucide-mail-check',
      detail: '后端强制锁定，不能被请求覆盖'
    }, {
      label: '可用模板',
      value: stats?.activeTemplates ?? 0,
      icon: 'i-lucide-panels-top-left',
      detail: '平台共享；发送域名仍由账户锁定'
    }, {
      label: '有效 API Keys',
      value: stats?.apiKeys ?? 0,
      icon: 'i-lucide-key-round',
      detail: '可按调用方创建多个 Key'
    }, {
      label: '近 7 天已发送',
      value: stats?.sent7d ?? 0,
      icon: 'i-lucide-send',
      detail: `${stats?.pending ?? 0} 个处理中，${stats?.failed7d ?? 0} 个失败`
    }]
  }
  return [{
    label: '可发送域名',
    value: `${stats?.sendingDomains ?? 0} / ${stats?.domains ?? 0}`,
    icon: 'i-lucide-globe-2',
    detail: '已接入 Email Sending'
  }, {
    label: '启用模板',
    value: `${stats?.activeTemplates ?? 0} / ${stats?.templates ?? 0}`,
    icon: 'i-lucide-panels-top-left',
    detail: '可供 REST 与 Webhook 调用'
  }, {
    label: '近 7 天已发送',
    value: stats?.sent7d ?? 0,
    icon: 'i-lucide-send',
    detail: `${stats?.pending ?? 0} 个任务处理中`
  }, {
    label: '近 7 天失败',
    value: stats?.failed7d ?? 0,
    icon: 'i-lucide-circle-alert',
    detail: '达到重试上限的任务'
  }]
})

const quickStart = computed(() => isAdmin.value
  ? [
      ['同步域名', '确认 Email Sending 状态与默认发件人', '/domains'],
      ['创建用户', '给用户分配唯一的专属发件邮箱', '/users'],
      ['创建模板', '维护共享 HTML，并为域名配置固定链接', '/templates'],
      ['触发发送', '使用 REST、Webhook 或后台手动发送', '/send']
    ]
  : [
      ['确认邮箱', auth.value.account?.senderEmail ?? '查看专属发件邮箱', '/send'],
      ['创建 API Key', '按环境或调用方创建多个独立 Key', '/keys'],
      ['选择模板', '使用管理员维护的共享启用模板', '/send'],
      ['查看日志', '跟踪 Queue 与 Email Service 状态', '/logs']
    ])

function statusColor(status: SendLogRecord['status']) {
  if (status === 'sent') return 'success'
  if (status === 'failed') return 'error'
  if (status === 'retrying') return 'warning'
  return 'neutral'
}
</script>

<template>
  <UDashboardPanel id="overview">
    <template #header>
      <UDashboardNavbar title="平台概览">
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>
        <template #right>
          <UButton
            icon="i-lucide-refresh-cw"
            color="neutral"
            variant="ghost"
            :loading="status === 'pending'"
            @click="refresh()"
          >
            刷新
          </UButton>
          <UButton to="/send" icon="i-lucide-send">
            发送邮件
          </UButton>
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <div class="space-y-8">
        <div>
          <p class="text-sm font-medium text-primary">
            CLOUDFLARE EMAIL OPERATIONS
          </p>
          <h1 class="mt-2 text-3xl font-semibold tracking-tight text-highlighted">
            事务型邮件，从模板到投递。
          </h1>
          <p class="mt-3 max-w-3xl text-muted">
            {{ isAdmin
              ? '域名、用户、共享模板、固定配置、API Key 和发送日志统一保存在 D1，外部触发写入 Queue，再由 Email Service 完成投递。'
              : `你的登录态由服务端 Cookie 管理，所有发送都锁定到 ${auth.account?.senderEmail}。` }}
          </p>
        </div>

        <div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <UCard v-for="card in cards" :key="card.label">
            <div class="flex items-start justify-between gap-4">
              <div>
                <p class="text-sm text-muted">
                  {{ card.label }}
                </p>
                <p class="mt-2 text-3xl font-semibold text-highlighted">
                  {{ card.value }}
                </p>
                <p class="mt-2 text-xs text-muted">
                  {{ card.detail }}
                </p>
              </div>
              <span class="grid size-10 place-items-center rounded-xl bg-primary/10 text-primary">
                <UIcon :name="card.icon" class="size-5" />
              </span>
            </div>
          </UCard>
        </div>

        <div class="grid gap-6 xl:grid-cols-[1.5fr_1fr]">
          <UCard>
            <template #header>
              <div class="flex items-center justify-between">
                <div>
                  <h2 class="font-semibold text-highlighted">
                    最近发送
                  </h2>
                  <p class="mt-1 text-sm text-muted">
                    Queue 与 Email Service 的最新任务状态
                  </p>
                </div>
                <UButton
                  to="/logs"
                  color="neutral"
                  variant="ghost"
                  trailing-icon="i-lucide-arrow-right"
                >
                  全部日志
                </UButton>
              </div>
            </template>

            <div v-if="!data?.recent.length" class="py-12 text-center text-sm text-muted">
              还没有发送记录。
            </div>
            <div v-else class="divide-y divide-default">
              <div
                v-for="log in data.recent"
                :key="log.id"
                class="flex items-center gap-4 py-4 first:pt-0 last:pb-0"
              >
                <span class="grid size-9 shrink-0 place-items-center rounded-lg bg-elevated">
                  <UIcon name="i-lucide-mail" class="size-4 text-muted" />
                </span>
                <div class="min-w-0 flex-1">
                  <p class="truncate text-sm font-medium text-highlighted">
                    {{ log.subject }}
                  </p>
                  <p class="mt-1 truncate text-xs text-muted">
                    {{ log.domainName }} · {{ log.to.join(', ') }}
                  </p>
                </div>
                <UBadge :color="statusColor(log.status)" variant="subtle">
                  {{ log.status }}
                </UBadge>
              </div>
            </div>
          </UCard>

          <UCard>
            <template #header>
              <div>
                <h2 class="font-semibold text-highlighted">
                  快速开始
                </h2>
                <p class="mt-1 text-sm text-muted">
                  完成一次可复用的模板发送链路
                </p>
              </div>
            </template>
            <ol class="space-y-5">
              <li
                v-for="(item, index) in quickStart"
                :key="item[0]"
                class="flex gap-3"
              >
                <span class="grid size-7 shrink-0 place-items-center rounded-full bg-primary text-xs font-semibold text-inverted">
                  {{ index + 1 }}
                </span>
                <div class="min-w-0">
                  <NuxtLink :to="item[2]" class="text-sm font-medium text-highlighted hover:text-primary">
                    {{ item[0] }}
                  </NuxtLink>
                  <p class="mt-1 text-xs leading-5 text-muted">
                    {{ item[1] }}
                  </p>
                </div>
              </li>
            </ol>
          </UCard>
        </div>
      </div>
    </template>
  </UDashboardPanel>
</template>
