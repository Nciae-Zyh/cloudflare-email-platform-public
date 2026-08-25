<script setup lang="ts">
import { z } from 'zod'

definePageMeta({ layout: 'auth' })

const toast = useToast()
const loading = ref(false)
const setupStatus = ref<{ setupRequired: boolean, setupTokenConfigured: boolean } | null>(null)
const state = ref({ setupToken: '', username: '', password: '', confirmPassword: '' })
const schema = z.object({
  setupToken: z.string()
    .trim()
    .min(16, '初始化令牌至少需要 16 个字符')
    .max(300, '初始化令牌不能超过 300 个字符'),
  username: z.string().min(3, '用户名至少 3 个字符'),
  password: z.string().min(12, '密码至少 12 个字符'),
  confirmPassword: z.string().min(12)
}).refine(value => value.password === value.confirmPassword, {
  message: '两次输入的密码不一致',
  path: ['confirmPassword']
})

onMounted(async () => {
  const result = await $fetch('/api/auth/setup') as {
    setupRequired: boolean
    setupTokenConfigured: boolean
  }
  setupStatus.value = result
  if (!result.setupRequired) await navigateTo('/login')
})

async function submit() {
  loading.value = true
  try {
    await $fetch('/api/auth/setup', {
      method: 'POST',
      body: {
        setupToken: state.value.setupToken.trim(),
        username: state.value.username,
        password: state.value.password
      }
    })
    toast.add({ title: '管理员已创建', color: 'success' })
    await navigateTo('/login')
  } catch (error) {
    toast.add({ title: '初始化失败', description: getErrorMessage(error), color: 'error' })
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <UCard>
    <template #header>
      <div>
        <p class="text-sm font-medium text-primary">
          首次初始化
        </p>
        <h1 class="mt-1 text-2xl font-semibold text-highlighted">
          创建平台管理员
        </h1>
        <p class="mt-2 text-sm text-muted">
          初始化成功后，该入口将自动关闭。
        </p>
      </div>
    </template>

    <UAlert
      v-if="setupStatus && !setupStatus.setupTokenConfigured"
      color="warning"
      icon="i-lucide-triangle-alert"
      title="尚未配置 SETUP_TOKEN"
      description="请先在 Cloudflare Worker 的 Variables and Secrets 中配置加密 SETUP_TOKEN。"
      class="mb-5"
    />

    <UForm
      :schema="schema"
      :state="state"
      class="space-y-5"
      @submit="submit"
    >
      <UFormField
        label="初始化令牌"
        name="setupToken"
        description="至少 16 个字符；请粘贴完整的 SETUP_TOKEN，不要包含引号。"
        required
      >
        <UInput
          v-model="state.setupToken"
          type="password"
          autocomplete="new-password"
          autocapitalize="none"
          :spellcheck="false"
          placeholder="部署时设置的 SETUP_TOKEN"
          class="w-full"
        />
      </UFormField>
      <UFormField label="管理员用户名" name="username" required>
        <UInput
          v-model="state.username"
          autocomplete="username"
          placeholder="例如 admin"
          class="w-full"
        />
      </UFormField>
      <UFormField label="密码" name="password" required>
        <UInput
          v-model="state.password"
          type="password"
          autocomplete="new-password"
          class="w-full"
        />
      </UFormField>
      <UFormField label="确认密码" name="confirmPassword" required>
        <UInput
          v-model="state.confirmPassword"
          type="password"
          autocomplete="new-password"
          class="w-full"
        />
      </UFormField>
      <UButton
        type="submit"
        block
        :loading="loading"
        icon="i-lucide-user-plus"
      >
        创建管理员
      </UButton>
    </UForm>
  </UCard>
</template>
