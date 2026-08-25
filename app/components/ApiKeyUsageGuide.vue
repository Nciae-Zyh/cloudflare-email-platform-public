<script setup lang="ts">
const props = defineProps<{
  senderEmail?: string | null
}>()

const toast = useToast()
const endpoint = `${useRequestURL().origin}/api/v1/send`
const apiKeyPlaceholder = 'cmp_live_YOUR_API_KEY'

const curlExample = computed(() => `curl --request POST '${endpoint}' \\
  --header 'Authorization: Bearer ${apiKeyPlaceholder}' \\
  --header 'Content-Type: application/json' \\
  --header 'Idempotency-Key: verification-user-10001' \\
  --data '{
    "template_key": "email_verification_code",
    "to": ["recipient@example.com"],
    "cc": [],
    "bcc": [],
    "variables": {
      "user": { "name": "Example User" },
      "verification": {
        "code": "483921",
        "expires_minutes": 10
      }
    },
    "priority": "normal"
  }'`)

const nodeExample = computed(() => `const response = await fetch('${endpoint}', {
  method: 'POST',
  headers: {
    Authorization: \`Bearer \${process.env.CLOUDMAIL_API_KEY}\`,
    'Content-Type': 'application/json',
    'Idempotency-Key': 'verification-user-10001'
  },
  body: JSON.stringify({
    template_key: 'email_verification_code',
    to: ['recipient@example.com'],
    variables: {
      user: { name: 'Example User' },
      verification: {
        code: '483921',
        expires_minutes: 10
      }
    },
    priority: 'normal'
  })
})

const result = await response.json()
if (!response.ok) {
  throw new Error(result.message || \`Email request failed: \${response.status}\`)
}

console.log(result.jobId, result.status, result.duplicate)`)

const requestFields = [
  {
    name: 'template_key',
    required: '必填*',
    description: '共享模板库中的启用模板 Key。也可以改用 template_id，二者提供一个即可。'
  },
  {
    name: 'to',
    required: '必填',
    description: '一个邮箱字符串或邮箱数组；至少 1 个地址。'
  },
  {
    name: 'cc / bcc',
    required: '可选',
    description: '一个邮箱字符串或邮箱数组；To、Cc、Bcc 合计最多 50 个唯一地址。'
  },
  {
    name: 'variables',
    required: '可选',
    description: '用于替换模板中的 {{variable.path}}；config 命名空间由域名固定配置注入，调用方不能覆盖。'
  },
  {
    name: 'priority',
    required: '可选',
    description: 'low、normal 或 high，默认 normal。'
  },
  {
    name: 'idempotency_key',
    required: '可选',
    description: '也可通过 Idempotency-Key 请求头提供；长度 8–200 个字符。'
  }
]

const responseCodes = [
  { code: '202', color: 'success' as const, description: '新任务已进入 Cloudflare Queue。' },
  { code: '200', color: 'info' as const, description: '相同 Key 与幂等键的任务已存在，返回原 jobId。' },
  { code: '400 / 413', color: 'warning' as const, description: '请求字段、收件人、变量或大小不符合要求。' },
  { code: '401', color: 'error' as const, description: 'Key 缺失、错误、已撤销，或其关联用户已停用。' },
  { code: '404 / 409', color: 'warning' as const, description: '模板不存在、未启用，或发送域名未启用。' },
  { code: '503', color: 'error' as const, description: '任务暂时无法写入 Queue，可以使用同一幂等键安全重试。' }
]

async function copy(value: string, label: string) {
  await navigator.clipboard.writeText(value)
  toast.add({ title: `${label}已复制`, color: 'success' })
}
</script>

<template>
  <UCard>
    <template #header>
      <div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div class="flex items-center gap-2">
            <UIcon name="i-lucide-terminal-square" class="size-5 text-primary" />
            <h2 class="font-semibold text-highlighted">
              使用 API Key 发送邮件
            </h2>
          </div>
          <p class="mt-1 text-sm text-muted">
            Key 只能在服务端使用。调用发送接口后，平台会渲染 HTML 模板并把任务写入 Cloudflare Queue。
          </p>
        </div>
        <UBadge color="neutral" variant="subtle" class="w-fit font-mono">
          POST /api/v1/send
        </UBadge>
      </div>
    </template>

    <div class="space-y-8">
      <section class="space-y-3">
        <h3 class="text-sm font-semibold text-highlighted">
          1. 准备 Key 与模板
        </h3>
        <ol class="grid gap-3 md:grid-cols-3">
          <li class="rounded-lg border border-default bg-muted/40 p-4">
            <p class="text-sm font-medium">
              创建并保存 Key
            </p>
            <p class="mt-1 text-xs leading-5 text-muted">
              完整 Key 只显示一次。请存入服务端 Secret 或密码管理器，不要提交到 Git。
            </p>
          </li>
          <li class="rounded-lg border border-default bg-muted/40 p-4">
            <p class="text-sm font-medium">
              启用 HTML 模板
            </p>
            <p class="mt-1 text-xs leading-5 text-muted">
              请求中的 template_key 来自共享模板库，并且模板状态必须为“启用”。
            </p>
          </li>
          <li class="rounded-lg border border-default bg-muted/40 p-4">
            <p class="text-sm font-medium">
              从服务端调用
            </p>
            <p class="mt-1 text-xs leading-5 text-muted">
              不要把 Key 放进浏览器代码、公开环境变量、URL 查询参数或客户端日志。
            </p>
          </li>
        </ol>
        <UAlert
          v-if="props.senderEmail"
          color="info"
          variant="subtle"
          icon="i-lucide-mail-check"
          :title="`当前 Key 的发件邮箱固定为 ${props.senderEmail}`"
          description="API 请求不接受自定义 From，模板也不能覆盖这个专属邮箱。"
        />
      </section>

      <section class="space-y-3">
        <div class="flex flex-wrap items-center justify-between gap-2">
          <h3 class="text-sm font-semibold text-highlighted">
            2. 请求地址与认证
          </h3>
          <UButton
            icon="i-lucide-copy"
            color="neutral"
            variant="ghost"
            size="xs"
            @click="copy(endpoint, '接口地址')"
          >
            复制地址
          </UButton>
        </div>
        <div class="overflow-x-auto rounded-lg border border-default bg-elevated px-4 py-3">
          <code class="whitespace-nowrap text-xs">{{ endpoint }}</code>
        </div>
        <div class="grid gap-3 md:grid-cols-2">
          <div class="rounded-lg border border-default p-4">
            <p class="font-mono text-xs text-highlighted">
              Authorization: Bearer cmp_live_...
            </p>
            <p class="mt-2 text-xs leading-5 text-muted">
              必填。Bearer 后放完整 API Key，不是列表中显示的 Key 前缀。
            </p>
          </div>
          <div class="rounded-lg border border-default p-4">
            <p class="font-mono text-xs text-highlighted">
              Idempotency-Key: your-business-event-id
            </p>
            <p class="mt-2 text-xs leading-5 text-muted">
              强烈建议。一次业务事件固定使用同一个值，超时重试时不要生成新值。
            </p>
          </div>
        </div>
      </section>

      <section class="space-y-3">
        <div class="flex flex-wrap items-center justify-between gap-2">
          <h3 class="text-sm font-semibold text-highlighted">
            3. cURL 示例
          </h3>
          <UButton
            icon="i-lucide-copy"
            color="neutral"
            variant="ghost"
            size="xs"
            @click="copy(curlExample, 'cURL 示例')"
          >
            复制
          </UButton>
        </div>
        <div class="overflow-x-auto rounded-lg bg-inverted p-4 text-inverted">
          <pre class="text-xs leading-5"><code>{{ curlExample }}</code></pre>
        </div>
      </section>

      <section class="space-y-3">
        <div class="flex flex-wrap items-center justify-between gap-2">
          <h3 class="text-sm font-semibold text-highlighted">
            4. Node.js / TypeScript 示例
          </h3>
          <UButton
            icon="i-lucide-copy"
            color="neutral"
            variant="ghost"
            size="xs"
            @click="copy(nodeExample, 'Node.js 示例')"
          >
            复制
          </UButton>
        </div>
        <div class="overflow-x-auto rounded-lg bg-inverted p-4 text-inverted">
          <pre class="text-xs leading-5"><code>{{ nodeExample }}</code></pre>
        </div>
      </section>

      <section class="space-y-3">
        <h3 class="text-sm font-semibold text-highlighted">
          5. JSON 字段
        </h3>
        <div class="overflow-x-auto rounded-lg border border-default">
          <table class="w-full min-w-2xl text-left text-sm">
            <thead class="bg-muted/70 text-xs text-muted">
              <tr>
                <th class="px-4 py-3 font-medium">
                  字段
                </th>
                <th class="px-4 py-3 font-medium">
                  要求
                </th>
                <th class="px-4 py-3 font-medium">
                  说明
                </th>
              </tr>
            </thead>
            <tbody class="divide-y divide-default">
              <tr v-for="field in requestFields" :key="field.name">
                <td class="px-4 py-3 font-mono text-xs text-highlighted">
                  {{ field.name }}
                </td>
                <td class="px-4 py-3 text-xs text-muted">
                  {{ field.required }}
                </td>
                <td class="px-4 py-3 text-xs leading-5 text-muted">
                  {{ field.description }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <p class="text-xs text-muted">
          * 如果使用 template_id，则不再需要 template_key。外部调用只能发送已启用的模板。
        </p>
      </section>

      <section class="space-y-3">
        <h3 class="text-sm font-semibold text-highlighted">
          6. 响应与重试
        </h3>
        <div class="rounded-lg border border-default bg-muted/40 p-4">
          <pre class="overflow-x-auto text-xs leading-5"><code>{
  "jobId": "5ef7b7ef-0a99-4cea-aa65-e503e62e9be9",
  "status": "queued",
  "duplicate": false
}</code></pre>
        </div>
        <div class="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          <div
            v-for="response in responseCodes"
            :key="response.code"
            class="rounded-lg border border-default p-4"
          >
            <UBadge :color="response.color" variant="subtle">
              HTTP {{ response.code }}
            </UBadge>
            <p class="mt-2 text-xs leading-5 text-muted">
              {{ response.description }}
            </p>
          </div>
        </div>
      </section>

      <UAlert
        color="warning"
        variant="subtle"
        icon="i-lucide-shield-alert"
        title="Key 安全建议"
        description="每个环境和调用方使用独立 Key；疑似泄漏时立即撤销并新建。不要在客户端、公开仓库、错误日志或截图中暴露完整 Key。"
      />
    </div>
  </UCard>
</template>
