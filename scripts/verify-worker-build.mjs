import { readdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const serverOutput = fileURLToPath(new URL('../.output/server/', import.meta.url))
const wranglerConfigPath = join(serverOutput, 'wrangler.json')
const requiredMarkers = [
  'cloudmail-queue-consumer-v1',
  'email.queue.batch',
  'X-CloudMail-Job-ID'
]

async function collectModules(directory) {
  const entries = await readdir(directory, { withFileTypes: true })
  const modules = []

  for (const entry of entries) {
    const path = join(directory, entry.name)
    if (entry.isDirectory()) {
      modules.push(...await collectModules(path))
    } else if (entry.isFile() && /\.(?:mjs|js)$/.test(entry.name)) {
      modules.push(path)
    }
  }

  return modules
}

const modules = await collectModules(serverOutput)
const sources = await Promise.all(modules.map(path => readFile(path, 'utf8')))
const bundle = sources.join('\n')
const missingMarkers = requiredMarkers.filter(marker => !bundle.includes(marker))

if (missingMarkers.length > 0) {
  throw new Error(
    `Cloudflare Worker build is missing the email queue consumer: ${missingMarkers.join(', ')}`
  )
}

const wrangler = JSON.parse(await readFile(wranglerConfigPath, 'utf8'))
const d1 = wrangler.d1_databases?.find(binding => binding.binding === 'DB')
const producer = wrangler.queues?.producers?.find(binding => binding.binding === 'EMAIL_QUEUE')
const consumer = wrangler.queues?.consumers?.find(binding => binding.queue === producer?.queue)
const email = wrangler.send_email?.find(binding => binding.name === 'EMAIL')
const requiredBuildValues = {
  CF_WORKER_NAME: wrangler.name,
  CF_EMAIL_QUEUE_NAME: producer?.queue,
  CF_EMAIL_DLQ_NAME: consumer?.dead_letter_queue
}
const missingBuildValues = Object.entries(requiredBuildValues)
  .filter(([, value]) => typeof value !== 'string' || !value)
  .map(([name]) => name)

if (missingBuildValues.length > 0) {
  throw new Error(
    `Generated Cloudflare config is incomplete: ${missingBuildValues.join(', ')}`
  )
}

if (wrangler.account_id && !/^[a-f0-9]{32}$/i.test(wrangler.account_id)) {
  throw new Error('CF_ACCOUNT_ID must be a 32-character Cloudflare account ID')
}

if (d1?.database_id && !/^[a-f0-9-]{36}$/i.test(d1.database_id)) {
  throw new Error('CF_D1_DATABASE_ID must be a D1 database UUID')
}

if (!d1 || !consumer || !email || wrangler.keep_vars !== true) {
  throw new Error('Generated Wrangler config is missing D1, Queue consumer, EMAIL binding, or keep_vars')
}

if (d1.binding !== 'DB' || producer.binding !== 'EMAIL_QUEUE') {
  throw new Error('Generated Wrangler bindings must use DB and EMAIL_QUEUE')
}

const d1Target = d1.database_id || d1.database_name || 'automatic provisioning'
console.log(`Verified Cloudflare Worker bindings; D1 target: ${d1Target}`)
