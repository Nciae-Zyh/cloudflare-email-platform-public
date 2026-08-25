<script setup lang="ts">
import type { DomainRecord, UserRecord } from '#shared/types'

const toast = useToast()
const creating = ref(false)
const savingAssignment = ref(false)
const creatingKey = ref(false)
const revealedKey = ref<string | null>(null)
const createForm = ref({
  username: '',
  password: '',
  domainId: '',
  senderLocal: '',
  senderName: ''
})
const assignmentForm = ref({
  userId: '',
  domainId: '',
  senderLocal: '',
  senderName: '',
  password: ''
})
const keyForm = ref({ userId: '', name: '' })

const { data: domainData } = await useFetch<{ domains: DomainRecord[] }>('/api/admin/domains')
const { data, status, refresh } = await useFetch<{ users: UserRecord[] }>('/api/admin/users')
const sendingDomains = computed(() => (domainData.value?.domains ?? [])
  .filter(domain => domain.sendingEnabled))
const domainItems = computed(() => sendingDomains.value.map(domain => ({
  label: domain.name,
  value: domain.id
})))
const userItems = computed(() => (data.value?.users ?? []).map(user => ({
  label: `${user.username} · ${user.senderEmail}`,
  value: user.id
})))

watchEffect(() => {
  createForm.value.domainId ||= domainItems.value[0]?.value ?? ''
  keyForm.value.userId ||= userItems.value[0]?.value ?? ''
})

async function createUser() {
  creating.value = true
  try {
    await $fetch('/api/admin/users', {
      method: 'POST',
      body: createForm.value
    })
    createForm.value = {
      username: '',
      password: '',
      domainId: domainItems.value[0]?.value ?? '',
      senderLocal: '',
      senderName: ''
    }
    await refresh()
    toast.add({ title: '用户与专属邮箱已创建', color: 'success' })
  } catch (error) {
    toast.add({ title: '创建失败', description: getErrorMessage(error), color: 'error' })
  } finally {
    creating.value = false
  }
}

function editUser(user: UserRecord) {
  assignmentForm.value = {
    userId: user.id,
    domainId: user.domainId,
    senderLocal: user.senderLocal,
    senderName: user.senderName,
    password: ''
  }
}

async function saveAssignment() {
  const form = assignmentForm.value
  if (!form.userId) return
  savingAssignment.value = true
  try {
    await $fetch(`/api/admin/users/${form.userId}`, {
      method: 'PATCH',
      body: {
        domainId: form.domainId,
        senderLocal: form.senderLocal,
        senderName: form.senderName,
        ...(form.password ? { password: form.password } : {})
      }
    })
    assignmentForm.value.password = ''
    await refresh()
    toast.add({ title: '用户绑定已更新', color: 'success' })
  } catch (error) {
    toast.add({ title: '更新失败', description: getErrorMessage(error), color: 'error' })
  } finally {
    savingAssignment.value = false
  }
}

async function setActive(user: UserRecord, active: boolean) {
  try {
    await $fetch(`/api/admin/users/${user.id}`, {
      method: 'PATCH',
      body: { active }
    })
    await refresh()
    toast.add({ title: active ? '用户已启用' : '用户已停用并清除会话', color: 'success' })
  } catch (error) {
    toast.add({ title: '操作失败', description: getErrorMessage(error), color: 'error' })
  }
}

async function createUserKey() {
  creatingKey.value = true
  try {
    const result = await $fetch('/api/admin/api-keys', {
      method: 'POST',
      body: keyForm.value
    }) as { key: string }
    revealedKey.value = result.key
    keyForm.value.name = ''
    await refresh()
  } catch (error) {
    toast.add({ title: 'Key 创建失败', description: getErrorMessage(error), color: 'error' })
  } finally {
    creatingKey.value = false
  }
}

async function copyKey() {
  if (!revealedKey.value) return
  await navigator.clipboard.writeText(revealedKey.value)
  toast.add({ title: 'API Key 已复制', color: 'success' })
}
</script>

<template>
  <UDashboardPanel id="users">
    <template #header>
      <UDashboardNavbar title="用户与邮箱">
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
      <div class="space-y-6">
        <UAlert
          v-if="revealedKey"
          color="warning"
          icon="i-lucide-key-round"
          title="用户 API Key（只显示一次）"
          description="Key 已锁定到该用户的发件邮箱，数据库仅保存摘要。"
        >
          <template #actions>
            <div class="mt-3 flex w-full items-center gap-2 rounded-lg bg-default p-2">
              <code class="min-w-0 flex-1 break-all text-xs">{{ revealedKey }}</code>
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

        <div class="grid gap-6 xl:grid-cols-3">
          <UCard>
            <template #header>
              <div>
                <h2 class="font-semibold text-highlighted">
                  创建用户
                </h2>
                <p class="mt-1 text-sm text-muted">
                  同时分配唯一的发件邮箱。
                </p>
              </div>
            </template>
            <div class="space-y-4">
              <UFormField label="用户名" required>
                <UInput v-model="createForm.username" autocomplete="off" class="w-full" />
              </UFormField>
              <UFormField label="初始密码" required hint="至少 12 个字符">
                <UInput
                  v-model="createForm.password"
                  type="password"
                  autocomplete="new-password"
                  class="w-full"
                />
              </UFormField>
              <UFormField label="发送域名" required>
                <USelect v-model="createForm.domainId" :items="domainItems" class="w-full" />
              </UFormField>
              <UFormField label="邮箱前缀" required>
                <UInput v-model="createForm.senderLocal" placeholder="alice" class="w-full">
                  <template #trailing>
                    <span class="text-xs text-muted">
                      @{{ sendingDomains.find(item => item.id === createForm.domainId)?.name }}
                    </span>
                  </template>
                </UInput>
              </UFormField>
              <UFormField label="发件人名称">
                <UInput v-model="createForm.senderName" placeholder="Alice" class="w-full" />
              </UFormField>
              <UButton
                block
                icon="i-lucide-user-plus"
                :loading="creating"
                :disabled="!createForm.username || createForm.password.length < 12 || !createForm.senderLocal"
                @click="createUser"
              >
                创建并分配邮箱
              </UButton>
            </div>
          </UCard>

          <UCard>
            <template #header>
              <div>
                <h2 class="font-semibold text-highlighted">
                  修改用户绑定
                </h2>
                <p class="mt-1 text-sm text-muted">
                  可迁移邮箱、修改显示名或重置密码。
                </p>
              </div>
            </template>
            <div v-if="assignmentForm.userId" class="space-y-4">
              <UFormField label="发送域名">
                <USelect v-model="assignmentForm.domainId" :items="domainItems" class="w-full" />
              </UFormField>
              <UFormField label="邮箱前缀">
                <UInput v-model="assignmentForm.senderLocal" class="w-full" />
              </UFormField>
              <UFormField label="发件人名称">
                <UInput v-model="assignmentForm.senderName" class="w-full" />
              </UFormField>
              <UFormField label="新密码" hint="留空则不修改">
                <UInput
                  v-model="assignmentForm.password"
                  type="password"
                  autocomplete="new-password"
                  class="w-full"
                />
              </UFormField>
              <UButton block :loading="savingAssignment" @click="saveAssignment">
                保存用户绑定
              </UButton>
            </div>
            <div v-else class="py-12 text-center text-sm text-muted">
              从下方用户列表选择“编辑”。
            </div>
          </UCard>

          <UCard>
            <template #header>
              <div>
                <h2 class="font-semibold text-highlighted">
                  为用户创建 Key
                </h2>
                <p class="mt-1 text-sm text-muted">
                  同一用户可以拥有多个独立、可撤销的 Key。
                </p>
              </div>
            </template>
            <div class="space-y-4">
              <UFormField label="用户">
                <USelect v-model="keyForm.userId" :items="userItems" class="w-full" />
              </UFormField>
              <UFormField label="Key 名称">
                <UInput v-model="keyForm.name" placeholder="Production backend" class="w-full" />
              </UFormField>
              <UButton
                block
                icon="i-lucide-key-round"
                :loading="creatingKey"
                :disabled="!keyForm.userId || !keyForm.name"
                @click="createUserKey"
              >
                创建用户 Key
              </UButton>
            </div>
          </UCard>
        </div>

        <UCard>
          <template #header>
            <h2 class="font-semibold text-highlighted">
              已分配用户
            </h2>
          </template>
          <div class="overflow-x-auto">
            <table class="w-full min-w-[900px] text-left text-sm">
              <thead class="border-b border-default text-xs text-muted">
                <tr>
                  <th class="px-3 py-3 font-medium">
                    用户
                  </th>
                  <th class="px-3 py-3 font-medium">
                    专属邮箱
                  </th>
                  <th class="px-3 py-3 font-medium">
                    有效 Key
                  </th>
                  <th class="px-3 py-3 font-medium">
                    最后登录
                  </th>
                  <th class="px-3 py-3 font-medium">
                    状态
                  </th>
                  <th class="px-3 py-3 text-right font-medium">
                    操作
                  </th>
                </tr>
              </thead>
              <tbody class="divide-y divide-default">
                <tr v-for="user in data?.users" :key="user.id">
                  <td class="px-3 py-4 font-medium">
                    {{ user.username }}
                  </td>
                  <td class="px-3 py-4">
                    <p>{{ user.senderEmail }}</p>
                    <p v-if="user.senderName" class="mt-1 text-xs text-muted">
                      {{ user.senderName }}
                    </p>
                  </td>
                  <td class="px-3 py-4">
                    {{ user.apiKeyCount }}
                  </td>
                  <td class="px-3 py-4 text-xs text-muted">
                    {{ user.lastLoginAt ? formatDateTime(user.lastLoginAt) : '从未' }}
                  </td>
                  <td class="px-3 py-4">
                    <UBadge :color="user.active ? 'success' : 'neutral'" variant="subtle">
                      {{ user.active ? '启用' : '停用' }}
                    </UBadge>
                  </td>
                  <td class="px-3 py-4">
                    <div class="flex justify-end gap-2">
                      <UButton
                        color="neutral"
                        variant="soft"
                        size="sm"
                        @click="editUser(user)"
                      >
                        编辑
                      </UButton>
                      <UButton
                        :color="user.active ? 'error' : 'success'"
                        variant="ghost"
                        size="sm"
                        @click="setActive(user, !user.active)"
                      >
                        {{ user.active ? '停用' : '启用' }}
                      </UButton>
                    </div>
                  </td>
                </tr>
                <tr v-if="!data?.users.length">
                  <td colspan="6" class="px-3 py-16 text-center text-muted">
                    尚未创建普通用户。
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </UCard>
      </div>
    </template>
  </UDashboardPanel>
</template>
