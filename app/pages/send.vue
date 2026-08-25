<script setup lang="ts">
import type { DomainRecord, TemplateRecord } from '#shared/types'
import { compileEmailTemplate, createSafePreviewDocument } from '#shared/email-template'

const toast = useToast()
const auth = useAuthState()
const isAdmin = computed(() => auth.value.account?.role === 'admin')
const sending = ref(false)
const domainEndpoint = isAdmin.value ? '/api/admin/domains' : '/api/account/domains'
const templateEndpoint = isAdmin.value ? '/api/admin/templates' : '/api/account/templates'
const { data: domainData } = await useFetch<{ domains: DomainRecord[] }>(domainEndpoint)
const { data: templateData } = await useFetch<{ templates: TemplateRecord[] }>(templateEndpoint)
const state = ref({
  domainId: '',
  templateId: '',
  to: '',
  cc: '',
  bcc: '',
  variables: `{
  "app": { "name": "CloudMail Platform" },
  "user": { "name": "Example User" },
  "verification": { "code": "123456", "expires_minutes": 10 },
  "action": { "url": "https://example.com/action" },
  "security": {
    "expires_minutes": 30,
    "changed_at": "2026-07-27 14:30 UTC",
    "ip_address": "203.0.113.10"
  },
  "inviter": { "name": "Alex Morgan" },
  "request": { "id": "REQ-2026-001" }
}`,
  priority: 'normal' as 'low' | 'normal' | 'high'
})

const templates = computed(() => (templateData.value?.templates ?? [])
  .filter(template => isAdmin.value ? template.status !== 'archived' : template.status === 'active'))
const domainItems = computed(() => (domainData.value?.domains ?? []).map(domain => ({
  label: `${domain.name}${domain.sendingEnabled ? '' : '（未启用发送）'}`,
  value: domain.id
})))
const templateItems = computed(() => templates.value.map(template => ({
  label: `${template.name}${template.status === 'draft' ? '（草稿）' : ''}`,
  value: template.id
})))
const selectedTemplate = computed(() => templates.value.find(template => template.id === state.value.templateId) ?? null)
const selectedDomain = computed(() => domainData.value?.domains.find(
  domain => domain.id === state.value.domainId
) ?? null)

const preview = computed(() => {
  if (!selectedTemplate.value) {
    return {
      subject: '请选择邮件模板',
      document: createSafePreviewDocument('<p>选择模板后会在这里安全预览。</p>'),
      error: null
    }
  }
  try {
    const inputVariables = JSON.parse(state.value.variables) as Record<string, unknown>
    const variables = {
      ...inputVariables,
      config: selectedDomain.value?.templateConfig ?? {}
    }
    const template = selectedTemplate.value
    const compiled = compileEmailTemplate({
      subjectTemplate: template.subjectTemplate,
      contentMode: template.contentMode,
      htmlTemplate: template.htmlTemplate,
      textTemplate: template.textTemplate,
      variables
    })
    return {
      subject: compiled.subject,
      document: createSafePreviewDocument(compiled.html),
      error: null
    }
  } catch (error) {
    return {
      subject: '变量 JSON 无效',
      document: createSafePreviewDocument('<p>请修复变量 JSON 后再预览。</p>'),
      error: error instanceof Error ? error.message : '预览失败'
    }
  }
})

watchEffect(() => {
  if (!state.value.domainId && domainItems.value[0]) {
    state.value.domainId = domainItems.value[0].value
  }
  if (!state.value.templateId && templateItems.value[0]) {
    state.value.templateId = templateItems.value[0].value
  }
})

function addresses(value: string): string[] {
  return value.split(/[\s,;]+/).map(item => item.trim()).filter(Boolean)
}

async function send() {
  const template = selectedTemplate.value
  if (!template) return
  sending.value = true
  try {
    const variables = JSON.parse(state.value.variables) as Record<string, unknown>
    const result = await $fetch(
      isAdmin.value ? '/api/admin/send' : '/api/account/send',
      {
        method: 'POST',
        body: {
          ...(isAdmin.value ? { domainId: state.value.domainId } : {}),
          template_id: template.id,
          to: addresses(state.value.to),
          cc: addresses(state.value.cc),
          bcc: addresses(state.value.bcc),
          variables,
          priority: state.value.priority,
          idempotency_key: `manual-${crypto.randomUUID()}`
        }
      }
    ) as { jobId: string }
    toast.add({
      title: '邮件任务已进入 Queue',
      description: `Job ID: ${result.jobId}`,
      color: 'success'
    })
  } catch (error) {
    toast.add({ title: '发送失败', description: getErrorMessage(error), color: 'error' })
  } finally {
    sending.value = false
  }
}
</script>

<template>
  <UDashboardPanel id="manual-send">
    <template #header>
      <UDashboardNavbar title="手动发送">
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>
        <template #right>
          <UButton icon="i-lucide-send" :loading="sending" @click="send">
            加入发送队列
          </UButton>
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <div class="grid gap-6 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <UCard>
          <template #header>
            <div>
              <h1 class="font-semibold text-highlighted">
                创建发送任务
              </h1>
              <p class="mt-1 text-sm text-muted">
                使用已配置模板发送一次事务型邮件。
              </p>
            </div>
          </template>
          <div class="space-y-5">
            <UAlert
              v-if="!isAdmin"
              color="info"
              icon="i-lucide-mail-check"
              title="固定发件邮箱"
              :description="`该任务将强制从 ${auth.account?.senderEmail} 发出，前端与 API 均不能覆盖。`"
            />
            <UFormField v-if="isAdmin" label="发送域名" required>
              <USelect v-model="state.domainId" :items="domainItems" class="w-full" />
            </UFormField>
            <UFormField label="邮件模板" required>
              <USelect v-model="state.templateId" :items="templateItems" class="w-full" />
            </UFormField>

            <UAlert
              v-if="selectedDomain && !selectedDomain.sendingEnabled"
              color="warning"
              icon="i-lucide-triangle-alert"
              title="当前域名尚未启用 Email Sending"
              :description="`${selectedDomain.name} 只能编辑和预览模板，暂时不能真实投递。`"
            />

            <UFormField label="To" required hint="逗号、分号或换行分隔">
              <UTextarea
                v-model="state.to"
                :rows="3"
                placeholder="user@example.com"
                class="w-full"
              />
            </UFormField>
            <div class="grid gap-4 sm:grid-cols-2">
              <UFormField label="Cc">
                <UTextarea
                  v-model="state.cc"
                  :rows="2"
                  placeholder="cc@example.com"
                  class="w-full"
                />
              </UFormField>
              <UFormField label="Bcc">
                <UTextarea
                  v-model="state.bcc"
                  :rows="2"
                  placeholder="bcc@example.com"
                  class="w-full"
                />
              </UFormField>
            </div>
            <UFormField label="优先级">
              <USelect
                v-model="state.priority"
                :items="[
                  { label: '普通', value: 'normal' },
                  { label: '高', value: 'high' },
                  { label: '低', value: 'low' }
                ]"
                class="w-full"
              />
            </UFormField>
            <UFormField label="模板变量 JSON">
              <UTextarea v-model="state.variables" :rows="12" class="w-full font-mono text-xs" />
            </UFormField>
            <UButton
              block
              icon="i-lucide-send"
              :loading="sending"
              :disabled="!selectedDomain?.sendingEnabled"
              @click="send"
            >
              加入发送队列
            </UButton>
          </div>
        </UCard>

        <UCard>
          <template #header>
            <div>
              <p class="text-xs text-muted">
                主题预览
              </p>
              <h2 class="mt-1 font-semibold text-highlighted">
                {{ preview.subject }}
              </h2>
            </div>
          </template>
          <UAlert
            v-if="preview.error"
            color="error"
            variant="subtle"
            :description="preview.error"
            class="mb-4"
          />
          <iframe
            title="手动发送邮件安全预览"
            :srcdoc="preview.document"
            sandbox=""
            referrerpolicy="no-referrer"
            class="h-[650px] w-full rounded-xl border border-default bg-white"
          />
        </UCard>
      </div>
    </template>
  </UDashboardPanel>
</template>
