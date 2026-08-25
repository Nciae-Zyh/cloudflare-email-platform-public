const SHANGHAI_OFFSET_MS = 8 * 60 * 60 * 1000

function parseTimestamp(value: string): Date {
  const normalized = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(value)
    ? `${value.replace(' ', 'T')}Z`
    : value

  return new Date(normalized)
}

export function formatDateTime(value: string): string {
  const date = parseTimestamp(value)
  if (Number.isNaN(date.getTime())) return '—'

  const local = new Date(date.getTime() + SHANGHAI_OFFSET_MS)
  const year = local.getUTCFullYear()
  const month = local.getUTCMonth() + 1
  const day = local.getUTCDate()
  const hours = String(local.getUTCHours()).padStart(2, '0')
  const minutes = String(local.getUTCMinutes()).padStart(2, '0')
  const seconds = String(local.getUTCSeconds()).padStart(2, '0')

  return `${year}/${month}/${day} ${hours}:${minutes}:${seconds}`
}
