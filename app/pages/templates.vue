<script setup lang="ts">
import type {
  DomainRecord,
  TemplateRecord,
  TemplateStatus
} from '#shared/types'
import {
  compileEmailTemplate,
  createSafePreviewDocument,
  EMAIL_LIMITS,
  extractVariableNames,
  templateSourceToHtml
} from '#shared/email-template'

type EditorState = {
  id: string | null
  templateKey: string
  name: string
  description: string
  subjectTemplate: string
  htmlTemplate: string
  fromLocal: string
  fromName: string
  replyTo: string
  status: TemplateStatus
}

const emptyEditor = (): EditorState => ({
  id: null,
  templateKey: '',
  name: '',
  description: '',
  subjectTemplate: 'Hello, {{user.name}}',
  htmlTemplate: `<div style="font-family:Arial,sans-serif;max-width:620px;margin:auto;padding:32px">
  <h1>Hello, {{user.name}}</h1>
  <p>Your request <strong>{{request.id}}</strong> has been completed.</p>
  <p>Thank you for using our service.</p>
</div>`,
  fromLocal: '',
  fromName: '',
  replyTo: '',
  status: 'draft'
})

const toast = useToast()
const saving = ref(false)
const legacyConverted = ref(false)
const searchQuery = ref('')
const previewDomainId = ref('')
const htmlFileInput = useTemplateRef<HTMLInputElement>('htmlFileInput')
const previewVariables = ref(`{
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
}`)
const editor = ref<EditorState>(emptyEditor())
const { data: domainData } = await useFetch<{ domains: DomainRecord[] }>('/api/admin/domains')
const { data, status, refresh } = await useFetch<{ templates: TemplateRecord[] }>('/api/admin/templates')

const domainItems = computed(() => (domainData.value?.domains ?? []).map(domain => ({
  label: `${domain.name}${domain.sendingEnabled ? '' : '（未启用发送）'}`,
  value: domain.id
})))
const selectedPreviewDomain = computed(() => (
  domainData.value?.domains.find(domain => domain.id === previewDomainId.value) ?? null
))
const filteredTemplates = computed(() => {
  const query = searchQuery.value.trim().toLowerCase()
  const templates = data.value?.templates ?? []
  if (!query) return templates
  return templates.filter(template => [
    template.name,
    template.templateKey,
    template.description ?? ''
  ].some(value => value.toLowerCase().includes(query)))
})
const statusItems = [
  { label: '草稿', value: 'draft' },
  { label: '启用', value: 'active' },
  { label: '归档', value: 'archived' }
]

const variableNames = computed(() => extractVariableNames(
  editor.value.subjectTemplate,
  editor.value.htmlTemplate
))

const preview = computed(() => {
  try {
    const inputVariables = JSON.parse(previewVariables.value) as Record<string, unknown>
    const variables = {
      ...inputVariables,
      config: selectedPreviewDomain.value?.templateConfig ?? {}
    }
    const compiled = compileEmailTemplate({
      subjectTemplate: editor.value.subjectTemplate,
      contentMode: 'html',
      htmlTemplate: editor.value.htmlTemplate,
      variables
    })
    return {
      subject: compiled.subject,
      document: createSafePreviewDocument(compiled.html),
      error: null
    }
  } catch (error) {
    return {
      subject: '',
      document: createSafePreviewDocument('<p>预览变量不是有效 JSON。</p>'),
      error: error instanceof Error ? error.message : '预览失败'
    }
  }
})

watchEffect(() => {
  if (!previewDomainId.value && domainItems.value[0]) {
    previewDomainId.value = domainItems.value[0].value
  }
})

function selectTemplate(template: TemplateRecord) {
  legacyConverted.value = template.contentMode === 'markdown'
  editor.value = {
    id: template.id,
    templateKey: template.templateKey,
    name: template.name,
    description: template.description ?? '',
    subjectTemplate: template.subjectTemplate,
    htmlTemplate: templateSourceToHtml(template.contentMode, template.htmlTemplate),
    fromLocal: template.fromLocal ?? '',
    fromName: template.fromName ?? '',
    replyTo: template.replyTo ?? '',
    status: template.status
  }
}

function createTemplate() {
  legacyConverted.value = false
  editor.value = emptyEditor()
}

async function save() {
  if (!editor.value.templateKey || !editor.value.name) {
    toast.add({ title: '请填写模板 Key 和名称', color: 'warning' })
    return
  }
  saving.value = true
  try {
    const body = {
      ...editor.value,
      contentMode: 'html' as const,
      textTemplate: null
    }
    if (editor.value.id) {
      await $fetch(`/api/admin/templates/${editor.value.id}`, { method: 'PATCH', body })
    } else {
      const result = await $fetch('/api/admin/templates', {
        method: 'POST',
        body
      }) as { id: string }
      editor.value.id = result.id
    }
    await refresh()
    legacyConverted.value = false
    toast.add({ title: '模板已保存', color: 'success' })
  } catch (error) {
    toast.add({ title: '保存失败', description: getErrorMessage(error), color: 'error' })
  } finally {
    saving.value = false
  }
}

function chooseHtmlFile() {
  htmlFileInput.value?.click()
}

async function importHtml(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return
  if (file.size > EMAIL_LIMITS.maxTemplateChars * 4) {
    toast.add({ title: 'HTML 文件过大', description: '模板正文不能超过 500,000 个字符。', color: 'warning' })
    return
  }
  const html = await file.text()
  if (!html.trim() || html.length > EMAIL_LIMITS.maxTemplateChars) {
    toast.add({ title: 'HTML 文件无效', description: '请选择不超过 500,000 个字符的 HTML 文件。', color: 'warning' })
    return
  }
  editor.value.htmlTemplate = html
  legacyConverted.value = false
  toast.add({ title: 'HTML 已导入', description: file.name, color: 'success' })
}

async function archive() {
  if (!editor.value.id) return
  await $fetch(`/api/admin/templates/${editor.value.id}`, { method: 'DELETE' })
  await refresh()
  createTemplate()
  toast.add({ title: '模板已归档', color: 'success' })
}
</script>

<template>
  <UDashboardPanel
    id="templates"
    :ui="{
      root: 'h-svh min-h-0 overflow-hidden',
      body: 'min-h-0 overflow-y-auto xl:overflow-hidden'
    }"
  >
    <template #header>
      <UDashboardNavbar title="邮件模板">
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>
        <template #right>
          <UButton icon="i-lucide-plus" @click="createTemplate">
            新建模板
          </UButton>
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <div class="grid min-h-full gap-6 xl:h-full xl:min-h-0 xl:grid-cols-[320px_minmax(0,1fr)]">
        <UCard
          class="xl:flex xl:h-full xl:min-h-0 xl:flex-col"
          :ui="{
            header: 'shrink-0',
            body: 'xl:min-h-0 xl:flex-1 xl:overflow-y-auto'
          }"
        >
          <template #header>
            <div class="space-y-3">
              <div>
                <h2 class="font-semibold text-highlighted">
                  共享模板库
                </h2>
                <p class="mt-1 text-xs text-muted">
                  所有域名和邮箱共用同一套模板
                </p>
              </div>
              <UInput
                v-model="searchQuery"
                icon="i-lucide-search"
                placeholder="搜索名称、Key 或说明"
                aria-label="搜索邮件模板"
                class="w-full"
              >
                <template v-if="searchQuery" #trailing>
                  <UButton
                    icon="i-lucide-x"
                    color="neutral"
                    variant="link"
                    size="xs"
                    aria-label="清空搜索"
                    @click="searchQuery = ''"
                  />
                </template>
              </UInput>
              <p class="text-xs text-dimmed">
                {{ filteredTemplates.length }} / {{ data?.templates.length ?? 0 }} 个模板
              </p>
            </div>
          </template>
          <div v-if="status === 'pending'" class="space-y-3">
            <USkeleton v-for="item in 4" :key="item" class="h-16" />
          </div>
          <div v-else-if="!data?.templates.length" class="py-8 text-center text-sm text-muted">
            还没有模板。
          </div>
          <div v-else-if="!filteredTemplates.length" class="py-8 text-center text-sm text-muted">
            没有匹配“{{ searchQuery }}”的模板。
          </div>
          <div v-else class="space-y-2">
            <button
              v-for="template in filteredTemplates"
              :key="template.id"
              type="button"
              class="w-full rounded-xl border p-3 text-left transition"
              :class="editor.id === template.id
                ? 'border-primary bg-primary/5'
                : 'border-default hover:bg-elevated'"
              @click="selectTemplate(template)"
            >
              <div class="flex items-center justify-between gap-2">
                <p class="truncate text-sm font-medium text-highlighted">
                  {{ template.name }}
                </p>
                <UBadge
                  :color="template.status === 'active' ? 'success' : 'neutral'"
                  variant="subtle"
                  size="sm"
                >
                  {{ template.status }}
                </UBadge>
              </div>
              <p class="mt-1 truncate font-mono text-xs text-muted">
                {{ template.templateKey }}
              </p>
              <p v-if="template.description" class="mt-1 line-clamp-2 text-xs text-dimmed">
                {{ template.description }}
              </p>
            </button>
          </div>
        </UCard>

        <div class="space-y-6 xl:min-h-0 xl:overflow-y-auto xl:pr-1">
          <UCard>
            <template #header>
              <div class="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 class="font-semibold text-highlighted">
                    {{ editor.id ? '编辑模板' : '新建模板' }}
                  </h2>
                  <p class="mt-1 text-sm text-muted">
                    该定义由所有域名和邮箱共享；变量使用安全转义的
                    <code v-pre>{{ variable.path }}</code> 语法。
                  </p>
                </div>
                <div class="flex gap-2">
                  <UButton
                    v-if="editor.id"
                    color="error"
                    variant="ghost"
                    icon="i-lucide-archive"
                    @click="archive"
                  >
                    归档
                  </UButton>
                  <UButton icon="i-lucide-save" :loading="saving" @click="save">
                    保存模板
                  </UButton>
                </div>
              </div>
            </template>

            <div class="space-y-5">
              <div class="grid gap-4 lg:grid-cols-2">
                <UFormField label="模板状态" required>
                  <USelect v-model="editor.status" :items="statusItems" class="w-full" />
                </UFormField>
                <UFormField label="模板名称" required>
                  <UInput v-model="editor.name" placeholder="Order confirmation" class="w-full" />
                </UFormField>
                <UFormField label="模板 Key" required hint="REST API 使用">
                  <UInput v-model="editor.templateKey" placeholder="order_confirmed" class="w-full" />
                </UFormField>
              </div>
              <UFormField label="说明">
                <UInput v-model="editor.description" placeholder="模板用途和触发时机" class="w-full" />
              </UFormField>
              <UFormField label="邮件主题" required>
                <UInput v-model="editor.subjectTemplate" class="w-full" />
              </UFormField>

              <div class="grid gap-4 lg:grid-cols-2">
                <UFormField label="发件前缀" hint="留空使用域名默认值">
                  <UInput v-model="editor.fromLocal" placeholder="noreply" class="w-full" />
                </UFormField>
                <UFormField label="发件人显示名" hint="留空使用域名默认值">
                  <UInput v-model="editor.fromName" placeholder="Notifications" class="w-full" />
                </UFormField>
              </div>
              <UFormField label="Reply-To">
                <UInput
                  v-model="editor.replyTo"
                  type="email"
                  placeholder="support@example.com"
                  class="w-full"
                />
              </UFormField>

              <UAlert
                v-if="legacyConverted"
                color="info"
                variant="subtle"
                icon="i-lucide-wand-sparkles"
                title="旧 Markdown 模板已转换为 HTML"
                description="预览已经使用转换后的 HTML；保存模板后会完成永久迁移。"
              />

              <div>
                <div class="mb-2 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div class="flex items-center gap-2">
                      <label class="text-sm font-medium">HTML 正文</label>
                      <UBadge color="primary" variant="subtle">
                        仅 HTML
                      </UBadge>
                    </div>
                    <p class="mt-1 text-xs text-muted">
                      换行请使用 &lt;p&gt; 或 &lt;br&gt;；纯文本版本会自动生成。
                    </p>
                  </div>
                  <div class="flex items-center gap-2">
                    <input
                      ref="htmlFileInput"
                      type="file"
                      accept=".html,.htm,text/html"
                      class="hidden"
                      @change="importHtml"
                    >
                    <UButton
                      color="neutral"
                      variant="outline"
                      size="sm"
                      icon="i-lucide-file-up"
                      @click="chooseHtmlFile"
                    >
                      导入 HTML
                    </UButton>
                  </div>
                </div>
                <UTextarea
                  v-model="editor.htmlTemplate"
                  :rows="15"
                  autoresize
                  class="w-full font-mono text-xs"
                />
                <div v-if="variableNames.length" class="mt-2 flex flex-wrap gap-1">
                  <UBadge
                    v-for="name in variableNames"
                    :key="name"
                    color="neutral"
                    variant="subtle"
                  >
                    {{ name }}
                  </UBadge>
                </div>
              </div>
            </div>
          </UCard>

          <div class="grid gap-6 lg:grid-cols-[1fr_1.4fr]">
            <UCard>
              <template #header>
                <div class="space-y-3">
                  <div>
                    <h3 class="font-semibold text-highlighted">
                      预览变量
                    </h3>
                    <p class="mt-1 text-xs text-muted">
                      JSON 仅用于本地预览，不会保存。
                    </p>
                  </div>
                  <UFormField
                    label="固定配置来源"
                    description="选中域名的配置会注入 config，并覆盖预览 JSON 中的同名字段。"
                  >
                    <USelect
                      v-model="previewDomainId"
                      :items="domainItems"
                      class="w-full"
                    />
                  </UFormField>
                  <p class="text-xs text-dimmed">
                    当前配置：{{ JSON.stringify(selectedPreviewDomain?.templateConfig ?? {}) }}
                  </p>
                </div>
              </template>
              <UTextarea v-model="previewVariables" :rows="14" class="w-full font-mono text-xs" />
              <UAlert
                v-if="preview.error"
                class="mt-4"
                color="error"
                variant="subtle"
                :description="preview.error"
              />
            </UCard>

            <UCard>
              <template #header>
                <div>
                  <p class="text-xs text-muted">
                    主题预览
                  </p>
                  <h3 class="mt-1 font-semibold text-highlighted">
                    {{ preview.subject || '—' }}
                  </h3>
                </div>
              </template>
              <iframe
                title="邮件模板安全预览"
                :srcdoc="preview.document"
                sandbox=""
                referrerpolicy="no-referrer"
                class="h-[420px] w-full rounded-xl border border-default bg-white"
              />
            </UCard>
          </div>
        </div>
      </div>
    </template>
  </UDashboardPanel>
</template>
