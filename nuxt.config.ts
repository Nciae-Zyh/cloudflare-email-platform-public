import process from 'node:process'

// https://nuxt.com/docs/api/configuration/nuxt-config
const defaultWorkerName = 'cloudflare-email-platform'
const workerName = process.env.CF_WORKER_NAME?.trim() || defaultWorkerName
const d1DatabaseName = process.env.CF_D1_DATABASE_NAME?.trim()
const emailQueueName = `${workerName}-send`
const emailDeadLetterQueueName = `${workerName}-dead-letter`

export default defineNuxtConfig({
  modules: [
    '@nuxt/eslint',
    '@nuxt/ui'
  ],

  devtools: {
    enabled: false
  },

  app: {
    head: {
      htmlAttrs: { lang: 'zh-CN' },
      title: 'CloudMail Platform',
      meta: [
        {
          name: 'description',
          content: '基于 Cloudflare Workers、Email Service、D1 和 Queues 的事务型邮件发送平台'
        }
      ]
    }
  },

  css: ['~/assets/css/main.css'],

  ui: {
    fonts: false
  },

  routeRules: {
    '/api/**': {
      cache: false,
      headers: {
        'cache-control': 'no-store'
      }
    }
  },

  compatibilityDate: '2026-07-27',

  nitro: {
    preset: 'cloudflare-module',
    cloudflare: {
      deployConfig: true,
      wrangler: {
        name: workerName,
        keep_vars: true,
        workers_dev: true,
        preview_urls: false,
        compatibility_flags: ['nodejs_compat'],
        observability: {
          enabled: true,
          logs: {
            head_sampling_rate: 1
          }
        },
        d1_databases: [
          {
            binding: 'DB',
            ...(d1DatabaseName
              ? { database_name: d1DatabaseName }
              : {}),
            migrations_dir: '../../migrations'
          }
        ],
        queues: {
          producers: [
            {
              binding: 'EMAIL_QUEUE',
              queue: emailQueueName
            }
          ],
          consumers: [
            {
              queue: emailQueueName,
              max_batch_size: 10,
              max_batch_timeout: 5,
              max_retries: 3,
              dead_letter_queue: emailDeadLetterQueueName
            }
          ]
        },
        send_email: [
          {
            name: 'EMAIL'
          }
        ]
      }
    }
  },

  typescript: {
    strict: true,
    typeCheck: false
  },

  eslint: {
    config: {
      stylistic: {
        commaDangle: 'never',
        braceStyle: '1tbs'
      }
    }
  }
})
