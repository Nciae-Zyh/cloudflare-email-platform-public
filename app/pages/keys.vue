<script setup lang="ts">
import type { ApiKeyRecord } from '#shared/types'

const toast = useToast()
const auth = useAuthState()
const creating = ref(false)
const name = ref('')
const revealed = ref<string | null>(null)
const { data, status, refresh } = await useFetch<{ apiKeys: ApiKeyRecord[] }>(
  '/api/account/api-keys'
)

async function createKey() {
  creating.value = true
  try {
    const result = await $fetch('/api/account/api-keys', {
      method: 'POST',
      body: { name: name.value }
    }) as { key: string }
    revealed.value = result.key
    name.value = ''
    await refresh()
  } catch (error) {
    toast.add({ title: '创建失败', description: getErrorMessage(error), color: 'error' })
  } finally {
    creating.value = false
  }
}

async function revokeKey(id: string) {
  await $fetch(`/api/account/api-keys/${id}`, { method: 'DELETE' })
  await refresh()
  toast.add({ title: 'API Key 已撤销', color: 'success' })
}

async function copyKey() {
  if (!revealed.value) return
  await navigator.clipboard.writeText(revealed.value)
  toast.add({ title: '已复制', color: 'success' })
}
</script>

<template>
  <UDashboardPanel id="keys">
    <template #header>
      <UDashboardNavbar title="我的 API Keys">
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
      <div class="mx-auto w-full max-w-5xl space-y-6">
        <UAlert
          color="info"
          icon="i-lucide-shield-check"
          title="Key 已锁定到你的专属邮箱"
          :description="`所有 Key 只能通过 ${auth.account?.senderEmail} 发送，不能覆盖发件域名或邮箱。`"
        />
        <UAlert
          v-if="revealed"
          color="warning"
          icon="i-lucide-key-round"
          title="新的 API Key（只显示一次）"
          description="请立即复制保存，数据库仅保存 SHA-256 摘要。"
        >
          <template #actions>
            <div class="mt-3 flex w-full items-center gap-2 rounded-lg bg-default p-2">
              <code class="min-w-0 flex-1 break-all text-xs">{{ revealed }}</code>
              <UButton
                icon="i-lucide-copy"
                color="neutral"
                variant="soft"
                @click="copyKey"
              >
                复制
              </UButton>
            </div>
          </template>
        </UAlert>

        <UCard>
          <template #header>
            <div>
              <h1 class="font-semibold text-highlighted">
                创建多个独立 Key
              </h1>
              <p class="mt-1 text-sm text-muted">
                建议按环境或调用方分别创建，便于单独撤销。
              </p>
            </div>
          </template>
          <div class="flex flex-col gap-3 sm:flex-row">
            <UInput
              v-model="name"
              placeholder="例如：Production API"
              class="min-w-0 flex-1"
            />
            <UButton
              icon="i-lucide-key-round"
              :loading="creating"
              :disabled="!name"
              @click="createKey"
            >
              创建 Key
            </UButton>
          </div>
        </UCard>

        <ApiKeyUsageGuide :sender-email="auth.account?.senderEmail" />

        <UCard>
          <template #header>
            <h2 class="font-semibold text-highlighted">
              Key 列表
            </h2>
          </template>
          <div v-if="!data?.apiKeys.length" class="py-12 text-center text-sm text-muted">
            尚未创建 API Key。
          </div>
          <div v-else class="divide-y divide-default">
            <div
              v-for="key in data.apiKeys"
              :key="key.id"
              class="flex items-center gap-3 py-4 first:pt-0 last:pb-0"
            >
              <UIcon name="i-lucide-key-round" class="size-5 shrink-0 text-muted" />
              <div class="min-w-0 flex-1">
                <p class="truncate font-medium">
                  {{ key.name }}
                </p>
                <p class="mt-1 truncate font-mono text-xs text-muted">
                  {{ key.keyPrefix }}… · {{ key.senderEmail }}
                </p>
              </div>
              <UBadge :color="key.revokedAt ? 'neutral' : 'success'" variant="subtle">
                {{ key.revokedAt ? '已撤销' : '有效' }}
              </UBadge>
              <UButton
                v-if="!key.revokedAt"
                icon="i-lucide-ban"
                color="error"
                variant="ghost"
                aria-label="撤销 API Key"
                @click="revokeKey(key.id)"
              />
            </div>
          </div>
        </UCard>
      </div>
    </template>
  </UDashboardPanel>
</template>
