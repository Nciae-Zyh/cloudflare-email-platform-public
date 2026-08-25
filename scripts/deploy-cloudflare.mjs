import { access } from 'node:fs/promises'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const wranglerConfig = fileURLToPath(
  new URL('../.output/server/wrangler.json', import.meta.url)
)

async function runWrangler(args) {
  await new Promise((resolve, reject) => {
    const command = spawn(
      process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm',
      ['exec', 'wrangler', ...args],
      {
        stdio: 'inherit',
        env: process.env
      }
    )

    command.on('error', reject)
    command.on('exit', (code, signal) => {
      if (code === 0) {
        resolve()
        return
      }

      reject(new Error(
        signal
          ? `Wrangler was terminated by ${signal}`
          : `Wrangler exited with code ${code ?? 'unknown'}`
      ))
    })
  })
}

await access(wranglerConfig)

console.log('Deploying Worker and provisioning missing Cloudflare bindings...')
await runWrangler([
  'deploy',
  '--config',
  wranglerConfig
])

console.log('Applying pending D1 migrations...')
await runWrangler([
  'd1',
  'migrations',
  'apply',
  'DB',
  '--remote',
  '--config',
  wranglerConfig
])

console.log('Verifying the initialized D1 schema...')
await runWrangler([
  'd1',
  'execute',
  'DB',
  '--remote',
  '--config',
  wranglerConfig,
  '--command',
  `SELECT
    (SELECT COUNT(*) FROM d1_migrations) AS migrations_applied,
    (SELECT COUNT(*) FROM admins) AS admins,
    (SELECT COUNT(*) FROM app_users) AS app_users,
    (SELECT COUNT(*) FROM domains) AS domains,
    (SELECT COUNT(*) FROM send_jobs) AS send_jobs;`
])

console.log('Cloudflare deployment and D1 initialization verified')
