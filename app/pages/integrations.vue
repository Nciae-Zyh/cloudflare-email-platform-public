<script setup lang="ts">
import type {
  ApiKeyRecord,
  DomainRecord,
  TemplateRecord,
  WebhookRecord
} from '#shared/types'

const toast = useToast()
const revealed = ref<{ title: string, value: string, endpoint?: string } | null>(null)
const keyForm = ref({ domainId: '', name: '' })
const webhookForm = ref({ domainId: '', templateId: '', name: '' })
const creatingKey = ref(false)
const creatingWebhook = ref(false)

const { data: domainData } = await useFetch<{ domains: DomainRecord[] }>('/api/admin/domains')
const { data: templateData } = await useFetch<{ templates: TemplateRecord[] }>('/api/admin/templates')
const { data: keyData, refresh: refreshKeys } = await useFetch<{ apiKeys: ApiKeyRecord[] }>('/api/admin/api-keys')
const { data: webhookData, refresh: refreshWebhooks } = await useFetch<{ webhooks: WebhookRecord[] }>('/api/admin/webhooks')

const domainItems = computed(() => (domainData.value?.domains ?? []).map(domain => ({
  label: domain.name,
  value: domain.id
})))
const sendingDomainItems = computed(() => (domainData.value?.domains ?? [])
  .filter(domain => domain.sendingEnabled)
  .map(domain => ({
    label: domain.name,
    value: domain.id
  })))
const templateItems = computed(() => (templateData.value?.templates ?? [])
  .filter(template => template.status === 'active')
  .map(template => ({
    label: template.name,
    value: template.id
  })))

watchEffect(() => {
  keyForm.value.domainId ||= domainItems.value[0]?.value ?? ''
  webhookForm.value.domainId ||= sendingDomainItems.value[0]?.value ?? ''
  webhookForm.value.templateId ||= templateItems.value[0]?.value ?? ''
})

async function createApiKey() {
  creatingKey.value = true
  try {
    const result = await $fetch('/api/admin/api-keys', {
      method: 'POST',
      body: keyForm.value
    }) as { key: string }
    revealed.value = { title: '新的 API Key', value: result.key }
    keyForm.value.name = ''
    await refreshKeys()
  } catch (error) {
    toast.add({ title: '创建失败', description: getErrorMessage(error), color: 'error' })
  } finally {
    creatingKey.value = false
  }
}

async function createWebhook() {
  creatingWebhook.value = true
  try {
    const result = await $fetch('/api/admin/webhooks', {
      method: 'POST',
      body: webhookForm.value
    }) as { secret: string, endpoint: string }
    revealed.value = {
      title: '新的 Webhook Secret',
      value: result.secret,
      endpoint: result.endpoint
    }
    webhookForm.value.name = ''
    await refreshWebhooks()
  } catch (error) {
    toast.add({ title: '创建失败', description: getErrorMessage(error), color: 'error' })
  } finally {
    creatingWebhook.value = false
  }
}

async function revokeKey(id: string) {
  await $fetch(`/api/admin/api-keys/${id}`, { method: 'DELETE' })
  await refreshKeys()
  toast.add({ title: 'API Key 已撤销', color: 'success' })
}

async function disableWebhook(id: string) {
  await $fetch(`/api/admin/webhooks/${id}`, { method: 'DELETE' })
  await refreshWebhooks()
  toast.add({ title: 'Webhook 已停用', color: 'success' })
}

async function copy(value: string) {
  await navigator.clipboard.writeText(value)
  toast.add({ title: '已复制到剪贴板', color: 'success' })
}
</script>

<template>
  <UDashboardPanel id="integrations">
    <template #header>
      <UDashboardNavbar title="API 与 Webhook">
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <div class="space-y-6">
        <UAlert
          v-if="revealed"
          color="warning"
          icon="i-lucide-key-round"
          :title="`${revealed.title}（只显示一次）`"
          description="请立即复制并保存；数据库只保存 SHA-256 摘要，之后无法恢复原值。"
        >
          <template #actions>
            <div class="mt-3 w-full space-y-2">
              <div v-if="revealed.endpoint" class="rounded-lg bg-default px-3 py-2 font-mono text-xs">
                POST {{ revealed.endpoint }}
              </div>
              <div class="flex items-center gap-2 rounded-lg bg-default p-2">
                <code class="min-w-0 flex-1 break-all text-xs">{{ revealed.value }}</code>
                <UButton
                  icon="i-lucide-copy"
                  color="neutral"
                  variant="soft"
                  @click="copy(revealed.value)"
                >
                  复制
                </UButton>
              </div>
            </div>
          </template>
        </UAlert>

        <div class="grid gap-6 xl:grid-cols-2">
          <UCard>
            <template #header>
              <div>
                <h2 class="font-semibold text-highlighted">
                  REST API Key
                </h2>
                <p class="mt-1 text-sm text-muted">
                  每个 Key 固定一个发送域名，并调用平台共享模板。
                </p>
              </div>
            </template>
            <div class="space-y-4">
              <UFormField label="域名">
                <USelect v-model="keyForm.domainId" :items="domainItems" class="w-full" />
              </UFormField>
              <UFormField label="Key 名称">
                <UInput v-model="keyForm.name" placeholder="Production backend" class="w-full" />
              </UFormField>
              <UButton
                icon="i-lucide-key-round"
                :loading="creatingKey"
                :disabled="!keyForm.domainId || !keyForm.name"
                @click="createApiKey"
              >
                生成 API Key
              </UButton>
            </div>
          </UCard>

          <UCard>
            <template #header>
              <div>
                <h2 class="font-semibold text-highlighted">
                  模板 Webhook
                </h2>
                <p class="mt-1 text-sm text-muted">
                  固定绑定一个启用模板，通过 Secret 请求头触发。
                </p>
              </div>
            </template>
            <div class="space-y-4">
              <UFormField label="发送域名">
                <USelect
                  v-model="webhookForm.domainId"
                  :items="sendingDomainItems"
                  class="w-full"
                />
              </UFormField>
              <UFormField label="启用模板">
                <USelect v-model="webhookForm.templateId" :items="templateItems" class="w-full" />
              </UFormField>
              <UFormField label="Webhook 名称">
                <UInput v-model="webhookForm.name" placeholder="Order completed" class="w-full" />
              </UFormField>
              <UButton
                icon="i-lucide-webhook"
                :loading="creatingWebhook"
                :disabled="!webhookForm.domainId || !webhookForm.templateId || !webhookForm.name"
                @click="createWebhook"
              >
                创建 Webhook
              </UButton>
            </div>
          </UCard>
        </div>

        <ApiKeyUsageGuide />

        <div class="grid gap-6 xl:grid-cols-2">
          <UCard>
            <template #header>
              <h2 class="font-semibold text-highlighted">
                已有 API Keys
              </h2>
            </template>
            <div v-if="!keyData?.apiKeys.length" class="py-8 text-center text-sm text-muted">
              暂无 API Key。
            </div>
            <div v-else class="divide-y divide-default">
              <div v-for="key in keyData.apiKeys" :key="key.id" class="flex items-center gap-3 py-4 first:pt-0 last:pb-0">
                <UIcon name="i-lucide-key-round" class="size-5 shrink-0 text-muted" />
                <div class="min-w-0 flex-1">
                  <p class="truncate text-sm font-medium">
                    {{ key.name }}
                  </p>
                  <p class="mt-1 truncate font-mono text-xs text-muted">
                    {{ key.keyPrefix }}… · {{ key.senderEmail || key.domainName }}
                  </p>
                  <p v-if="key.username" class="mt-1 truncate text-xs text-muted">
                    用户：{{ key.username }}
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

          <UCard>
            <template #header>
              <h2 class="font-semibold text-highlighted">
                已有 Webhooks
              </h2>
            </template>
            <div v-if="!webhookData?.webhooks.length" class="py-8 text-center text-sm text-muted">
              暂无 Webhook。
            </div>
            <div v-else class="divide-y divide-default">
              <div v-for="webhook in webhookData.webhooks" :key="webhook.id" class="flex items-center gap-3 py-4 first:pt-0 last:pb-0">
                <UIcon name="i-lucide-webhook" class="size-5 shrink-0 text-muted" />
                <div class="min-w-0 flex-1">
                  <p class="truncate text-sm font-medium">
                    {{ webhook.name }}
                  </p>
                  <p class="mt-1 truncate text-xs text-muted">
                    {{ webhook.templateName }} · {{ webhook.domainName }}
                  </p>
                </div>
                <UBadge :color="webhook.active ? 'success' : 'neutral'" variant="subtle">
                  {{ webhook.active ? '有效' : '停用' }}
                </UBadge>
                <UButton
                  v-if="webhook.active"
                  icon="i-lucide-ban"
                  color="error"
                  variant="ghost"
                  aria-label="停用 Webhook"
                  @click="disableWebhook(webhook.id)"
                />
              </div>
            </div>
          </UCard>
        </div>
      </div>
    </template>
  </UDashboardPanel>
</template>
