<script setup lang="ts">
import type { DomainRecord, SendJobStatus, SendLogRecord } from '#shared/types'

const auth = useAuthState()
const isAdmin = computed(() => auth.value.account?.role === 'admin')
const filters = ref<{ status: SendJobStatus | 'all', domainId: string }>({
  status: 'all',
  domainId: 'all'
})
const query = computed(() => ({
  ...(filters.value.status !== 'all' ? { status: filters.value.status } : {}),
  ...(isAdmin.value && filters.value.domainId !== 'all'
    ? { domainId: filters.value.domainId }
    : {}),
  limit: 100
}))
const domainEndpoint = isAdmin.value ? '/api/admin/domains' : '/api/account/domains'
const logsEndpoint = isAdmin.value ? '/api/admin/logs' : '/api/account/logs'
const { data: domainData } = await useFetch<{ domains: DomainRecord[] }>(domainEndpoint)
const { data, status, refresh } = await useFetch<{ logs: SendLogRecord[] }>(logsEndpoint, {
  query,
  watch: [query]
})

const domainItems = computed(() => [
  { label: '全部域名', value: 'all' },
  ...(domainData.value?.domains ?? []).map(domain => ({ label: domain.name, value: domain.id }))
])
const statusItems = [
  { label: '全部状态', value: 'all' },
  { label: '已排队', value: 'queued' },
  { label: '处理中', value: 'processing' },
  { label: '重试中', value: 'retrying' },
  { label: '已发送', value: 'sent' },
  { label: '失败', value: 'failed' }
]

function statusColor(value: SendJobStatus) {
  if (value === 'sent') return 'success'
  if (value === 'failed') return 'error'
  if (value === 'retrying') return 'warning'
  return 'neutral'
}
</script>

<template>
  <UDashboardPanel id="logs">
    <template #header>
      <UDashboardNavbar title="发送日志">
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
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <UCard>
        <template #header>
          <div class="flex flex-wrap items-end gap-4">
            <UFormField label="状态">
              <USelect v-model="filters.status" :items="statusItems" class="w-40" />
            </UFormField>
            <UFormField v-if="isAdmin" label="域名">
              <USelect v-model="filters.domainId" :items="domainItems" class="w-64" />
            </UFormField>
            <p class="ml-auto text-sm text-muted">
              最多显示最近 100 条
            </p>
          </div>
        </template>

        <div class="overflow-x-auto">
          <table class="w-full min-w-[960px] text-left text-sm">
            <thead class="border-b border-default text-xs text-muted">
              <tr>
                <th class="px-3 py-3 font-medium">
                  时间
                </th>
                <th class="px-3 py-3 font-medium">
                  状态
                </th>
                <th class="px-3 py-3 font-medium">
                  来源
                </th>
                <th v-if="isAdmin" class="px-3 py-3 font-medium">
                  用户
                </th>
                <th class="px-3 py-3 font-medium">
                  域名 / 模板
                </th>
                <th class="px-3 py-3 font-medium">
                  主题
                </th>
                <th class="px-3 py-3 font-medium">
                  收件人
                </th>
                <th class="px-3 py-3 font-medium">
                  尝试
                </th>
              </tr>
            </thead>
            <tbody class="divide-y divide-default">
              <tr v-for="log in data?.logs" :key="log.id" class="hover:bg-elevated/50">
                <td class="whitespace-nowrap px-3 py-4 text-xs text-muted">
                  {{ formatDateTime(log.queuedAt) }}
                </td>
                <td class="px-3 py-4">
                  <UBadge :color="statusColor(log.status)" variant="subtle">
                    {{ log.status }}
                  </UBadge>
                </td>
                <td class="px-3 py-4">
                  {{ log.source }}
                </td>
                <td v-if="isAdmin" class="px-3 py-4">
                  {{ log.username || '平台管理员' }}
                </td>
                <td class="px-3 py-4">
                  <p class="font-medium">
                    {{ log.domainName }}
                  </p>
                  <p class="mt-1 text-xs text-muted">
                    {{ log.templateName || '—' }}
                  </p>
                </td>
                <td class="max-w-xs px-3 py-4">
                  <p class="truncate">
                    {{ log.subject }}
                  </p>
                  <p v-if="log.errorMessage" class="mt-1 truncate text-xs text-error">
                    {{ log.errorMessage }}
                  </p>
                </td>
                <td class="max-w-xs px-3 py-4">
                  <p class="truncate text-xs">
                    {{ log.to.join(', ') }}
                  </p>
                </td>
                <td class="px-3 py-4">
                  {{ log.attempts }}
                </td>
              </tr>
              <tr v-if="!data?.logs.length">
                <td :colspan="isAdmin ? 8 : 7" class="px-3 py-16 text-center text-muted">
                  暂无符合条件的日志。
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </UCard>
    </template>
  </UDashboardPanel>
</template>
