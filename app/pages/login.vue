<script setup lang="ts">
import { z } from 'zod'

definePageMeta({ layout: 'auth' })

const toast = useToast()
const loading = ref(false)
const state = ref({ username: '', password: '' })
const schema = z.object({
  username: z.string().min(1, '请输入用户名'),
  password: z.string().min(1, '请输入密码')
})

onMounted(async () => {
  const auth = await refreshAuthState()
  if (auth.setupRequired) await navigateTo('/setup')
  else if (auth.authenticated) await navigateTo('/')
})

async function submit() {
  loading.value = true
  try {
    const result = await $fetch('/api/auth/login', {
      method: 'POST',
      body: state.value
    }) as { account: import('#shared/types').AccountRecord }
    const auth = useAuthState()
    auth.value = {
      loaded: true,
      authenticated: true,
      account: result.account,
      setupRequired: false
    }
    await navigateTo('/')
  } catch (error) {
    toast.add({ title: '登录失败', description: getErrorMessage(error), color: 'error' })
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
          账户登录
        </p>
        <h1 class="mt-1 text-2xl font-semibold text-highlighted">
          欢迎回来
        </h1>
        <p class="mt-2 text-sm text-muted">
          登录信息不会在页面中预填或写入前端代码。
        </p>
      </div>
    </template>

    <UForm
      :schema="schema"
      :state="state"
      class="space-y-5"
      @submit="submit"
    >
      <UFormField label="用户名" name="username" required>
        <UInput
          v-model="state.username"
          autocomplete="username"
          placeholder="请输入用户名"
          icon="i-lucide-user"
          class="w-full"
        />
      </UFormField>
      <UFormField label="密码" name="password" required>
        <UInput
          v-model="state.password"
          type="password"
          autocomplete="current-password"
          placeholder="请输入密码"
          icon="i-lucide-lock-keyhole"
          class="w-full"
        />
      </UFormField>
      <UButton
        type="submit"
        block
        :loading="loading"
        icon="i-lucide-log-in"
      >
        登录邮件平台
      </UButton>
    </UForm>
  </UCard>
</template>
