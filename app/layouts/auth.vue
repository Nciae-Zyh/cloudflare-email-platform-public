<template>
  <main class="code-grid min-h-screen">
    <div class="mx-auto grid min-h-screen max-w-6xl place-items-center px-6 py-12">
      <div class="w-full max-w-md">
        <NuxtLink to="/" class="mb-8 flex items-center justify-center gap-3">
          <span class="grid size-11 place-items-center rounded-2xl bg-primary text-inverted shadow-lg shadow-primary/20">
            <UIcon name="i-lucide-cloud-lightning" class="size-6" />
          </span>
          <div>
            <p class="font-semibold text-highlighted">CloudMail Platform</p>
            <p class="text-xs text-muted">Powered by Cloudflare</p>
          </div>
        </NuxtLink>
        <slot />
      </div>
    </div>
  </main>
</template>
