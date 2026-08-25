<script setup lang="ts">
import type { DomainRecord } from '#shared/types'

const toast = useToast()
const syncing = ref(false)
const savingId = ref<string | null>(null)
const { data, status, refresh } = await useFetch<{ domains: DomainRecord[] }>('/api/admin/domains')
const edits = ref<Record<string, {
  defaultFromLocal: string
  defaultFromName: string
  defaultReplyTo: string
  templateConfig: string
}>>({})

watchEffect(() => {
  for (const domain of data.value?.domains ?? []) {
    edits.value[domain.id] ??= {
      defaultFromLocal: domain.defaultFromLocal,
      defaultFromName: domain.defaultFromName,
      defaultReplyTo: domain.defaultReplyTo ?? '',
      templateConfig: JSON.stringify(domain.templateConfig, null, 2)
    }
  }
})

async function syncDomains() {
  syncing.value = true
  try {
    const result = await $fetch(
      '/api/admin/domains/sync',
      { method: 'POST' }
    ) as {
      domainCount: number
      sendingEnabledCount: number
      defaultTemplatesCreated: number
    }
    await refresh()
    toast.add({
      title: '域名同步完成',
      description: `读取 ${result.domainCount} 个域名，${result.sendingEnabledCount} 个可发送，新增 ${result.defaultTemplatesCreated} 个英文默认模板。`,
      color: 'success'
    })
  } catch (error) {
    toast.add({ title: '同步失败', description: getErrorMessage(error), color: 'error' })
  } finally {
    syncing.value = false
  }
}

async function saveDomain(domain: DomainRecord) {
  savingId.value = domain.id
  try {
    const templateConfig = JSON.parse(edits.value[domain.id]!.templateConfig) as unknown
    if (!templateConfig || typeof templateConfig !== 'object' || Array.isArray(templateConfig)) {
      throw new Error('模板固定变量必须是 JSON 对象。')
    }
    await $fetch(`/api/admin/domains/${domain.id}`, {
      method: 'PATCH',
      body: {
        ...edits.value[domain.id],
        templateConfig
      }
    })
    await refresh()
    toast.add({ title: `${domain.name} 配置已保存`, color: 'success' })
  } catch (error) {
    toast.add({ title: '保存失败', description: getErrorMessage(error), color: 'error' })
  } finally {
    savingId.value = null
  }
}
</script>

<template>
  <UDashboardPanel id="domains">
    <template #header>
      <UDashboardNavbar title="域名管理">
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>
        <template #right>
          <UButton
            icon="i-lucide-refresh-cw"
            :loading="syncing"
            @click="syncDomains"
          >
            从 Cloudflare 同步
          </UButton>
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <div class="space-y-6">
        <UAlert
          icon="i-lucide-info"
          color="info"
          variant="subtle"
          title="域名来源"
          description="同步会读取指定 Cloudflare 账户的活动 Zone 与 Email Sending 域名。只有已启用发送的域名可创建真实投递任务。"
        />

        <div v-if="status === 'pending'" class="grid gap-4 lg:grid-cols-2">
          <USkeleton v-for="item in 4" :key="item" class="h-64" />
        </div>
        <div v-else class="grid gap-5 xl:grid-cols-2">
          <UCard v-for="domain in data?.domains" :key="domain.id">
            <template #header>
              <div class="flex items-start justify-between gap-4">
                <div class="min-w-0">
                  <div class="flex items-center gap-2">
                    <h2 class="truncate font-semibold text-highlighted">
                      {{ domain.name }}
                    </h2>
                    <UBadge :color="domain.sendingEnabled ? 'success' : 'warning'" variant="subtle">
                      {{ domain.sendingEnabled ? '可发送' : '未接入发送' }}
                    </UBadge>
                  </div>
                  <p class="mt-2 truncate font-mono text-xs text-muted">
                    Zone: {{ domain.zoneId }}
                  </p>
                </div>
                <UIcon
                  :name="domain.sendingEnabled ? 'i-lucide-badge-check' : 'i-lucide-circle-dashed'"
                  :class="domain.sendingEnabled ? 'text-success' : 'text-warning'"
                  class="size-6"
                />
              </div>
            </template>

            <div class="space-y-4">
              <div class="grid gap-4 sm:grid-cols-2">
                <UFormField label="默认发件前缀">
                  <UInput
                    v-model="edits[domain.id]!.defaultFromLocal"
                    placeholder="noreply"
                    class="w-full"
                  >
                    <template #trailing>
                      <span class="text-xs text-dimmed">@{{ domain.name }}</span>
                    </template>
                  </UInput>
                </UFormField>
                <UFormField label="默认显示名">
                  <UInput
                    v-model="edits[domain.id]!.defaultFromName"
                    placeholder="CloudMail Platform"
                    class="w-full"
                  />
                </UFormField>
              </div>
              <UFormField label="默认 Reply-To">
                <UInput
                  v-model="edits[domain.id]!.defaultReplyTo"
                  type="email"
                  placeholder="support@example.com（可选）"
                  class="w-full"
                />
              </UFormField>
              <UFormField
                label="模板固定变量"
                :description="'JSON 会注入 config 命名空间，API 请求不能覆盖。模板中可写 {{config.links.login}}。'"
              >
                <UTextarea
                  v-model="edits[domain.id]!.templateConfig"
                  :rows="7"
                  class="w-full font-mono text-xs"
                  placeholder="{&#10;  &quot;links&quot;: {&#10;    &quot;login&quot;: &quot;https://example.com/login&quot;&#10;  }&#10;}"
                />
              </UFormField>

              <dl class="grid grid-cols-2 gap-3 rounded-xl bg-elevated/60 p-4 text-xs">
                <div>
                  <dt class="text-muted">
                    DKIM Selector
                  </dt>
                  <dd class="mt-1 font-mono text-highlighted">
                    {{ domain.dkimSelector || '—' }}
                  </dd>
                </div>
                <div>
                  <dt class="text-muted">
                    Return-Path
                  </dt>
                  <dd class="mt-1 truncate font-mono text-highlighted">
                    {{ domain.returnPathDomain || '—' }}
                  </dd>
                </div>
              </dl>
            </div>

            <template #footer>
              <div class="flex items-center justify-between gap-3">
                <p class="text-xs text-muted">
                  最后同步：{{ formatDateTime(domain.lastSyncedAt) }}
                </p>
                <UButton
                  color="neutral"
                  variant="soft"
                  :loading="savingId === domain.id"
                  @click="saveDomain(domain)"
                >
                  保存配置
                </UButton>
              </div>
            </template>
          </UCard>
        </div>
      </div>
    </template>
  </UDashboardPanel>
</template>
