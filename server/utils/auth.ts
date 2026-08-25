import {
  deleteCookie,
  getCookie,
  getRequestURL,
  setCookie,
  type H3Event
} from 'h3'
import type { AccountRecord } from '../../shared/types'
import { createSecret, sha256Base64Url, verifyPassword } from './crypto'
import { useCloudflareEnv } from './bindings'

const SESSION_COOKIE = 'cloudmail_session'

type CredentialRow = {
  id: string
  username: string
  password_hash: string
  password_salt: string
  password_iterations: number
  domain_id?: string
  domain_name?: string
  sender_local?: string
  sender_name?: string
  active?: number
}

function sessionTtlSeconds(env: CloudflareEnv): number {
  const ttl = Number(useRuntimeSecrets(env).SESSION_TTL_SECONDS ?? 28_800)
  return Number.isFinite(ttl) && ttl >= 900 ? ttl : 28_800
}

function adminAccount(row: Pick<CredentialRow, 'id' | 'username'>): AccountRecord {
  return {
    id: row.id,
    username: row.username,
    role: 'admin',
    domainId: null,
    domainName: null,
    senderEmail: null,
    senderName: null
  }
}

function userAccount(row: CredentialRow): AccountRecord {
  const domainName = String(row.domain_name)
  return {
    id: row.id,
    username: row.username,
    role: 'user',
    domainId: String(row.domain_id),
    domainName,
    senderEmail: `${String(row.sender_local)}@${domainName}`,
    senderName: String(row.sender_name ?? '')
  }
}

async function createSession(
  event: H3Event,
  account: AccountRecord
): Promise<void> {
  const env = useCloudflareEnv(event)
  const token = createSecret('cms_')
  const tokenHash = await sha256Base64Url(token)
  const now = new Date()
  const ttl = sessionTtlSeconds(env)
  const expiresAt = new Date(now.getTime() + ttl * 1000)
  const sessionTable = account.role === 'admin' ? 'admin_sessions' : 'user_sessions'
  const principalColumn = account.role === 'admin' ? 'admin_id' : 'user_id'
  const principalTable = account.role === 'admin' ? 'admins' : 'app_users'

  await env.DB.batch([
    env.DB.prepare(`
      INSERT INTO ${sessionTable}
        (token_hash, ${principalColumn}, expires_at, created_at, last_seen_at)
      VALUES (?, ?, ?, ?, ?)
    `).bind(tokenHash, account.id, expiresAt.toISOString(), now.toISOString(), now.toISOString()),
    env.DB.prepare(`
      UPDATE ${principalTable} SET last_login_at = ? WHERE id = ?
    `).bind(now.toISOString(), account.id),
    env.DB.prepare(`
      DELETE FROM ${sessionTable} WHERE expires_at <= ?
    `).bind(now.toISOString())
  ])

  setCookie(event, SESSION_COOKIE, token, {
    httpOnly: true,
    secure: getRequestURL(event).protocol === 'https:',
    sameSite: 'strict',
    path: '/',
    maxAge: ttl
  })
}

export async function loginAccount(
  event: H3Event,
  username: string,
  password: string
): Promise<AccountRecord | null> {
  const env = useCloudflareEnv(event)
  const normalizedUsername = username.trim()
  const [admin, user] = await Promise.all([
    env.DB.prepare(`
      SELECT id, username, password_hash, password_salt, password_iterations
      FROM admins
      WHERE username = ?
    `).bind(normalizedUsername).first<CredentialRow>(),
    env.DB.prepare(`
      SELECT u.id, u.username, u.password_hash, u.password_salt,
             u.password_iterations, u.domain_id, d.name AS domain_name,
             u.sender_local, u.sender_name, u.active
      FROM app_users u
      JOIN domains d ON d.id = u.domain_id
      WHERE u.username = ?
    `).bind(normalizedUsername).first<CredentialRow>()
  ])

  const credential = admin ?? user
  if (!credential || (!admin && credential.active !== 1)) {
    await verifyPassword({
      password,
      expectedHash: 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
      salt: 'invalid-user-salt',
      iterations: 100_000
    })
    return null
  }

  const valid = await verifyPassword({
    password,
    expectedHash: credential.password_hash,
    salt: credential.password_salt,
    iterations: credential.password_iterations
  })
  if (!valid) return null

  const account = admin ? adminAccount(admin) : userAccount(credential)
  await createSession(event, account)
  return account
}

export async function getCurrentAccount(event: H3Event): Promise<AccountRecord | null> {
  const token = getCookie(event, SESSION_COOKIE)
  if (!token) return null

  const env = useCloudflareEnv(event)
  const tokenHash = await sha256Base64Url(token)
  const now = new Date().toISOString()
  const [admin, user] = await Promise.all([
    env.DB.prepare(`
      SELECT a.id, a.username
      FROM admin_sessions s
      JOIN admins a ON a.id = s.admin_id
      WHERE s.token_hash = ? AND s.expires_at > ?
    `).bind(tokenHash, now).first<CredentialRow>(),
    env.DB.prepare(`
      SELECT u.id, u.username, u.domain_id, d.name AS domain_name,
             u.sender_local, u.sender_name, u.active
      FROM user_sessions s
      JOIN app_users u ON u.id = s.user_id
      JOIN domains d ON d.id = u.domain_id
      WHERE s.token_hash = ? AND s.expires_at > ? AND u.active = 1
    `).bind(tokenHash, now).first<CredentialRow>()
  ])

  if (!admin && !user) {
    deleteCookie(event, SESSION_COOKIE, { path: '/' })
    return null
  }

  const sessionTable = admin ? 'admin_sessions' : 'user_sessions'
  await env.DB.prepare(`
    UPDATE ${sessionTable} SET last_seen_at = ? WHERE token_hash = ?
  `).bind(now, tokenHash).run()

  return admin ? adminAccount(admin) : userAccount(user!)
}

export async function requireAccount(event: H3Event): Promise<AccountRecord> {
  const account = await getCurrentAccount(event)
  if (!account) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Unauthorized',
      message: '请先登录邮件平台。'
    })
  }
  return account
}

export async function requireAdmin(event: H3Event): Promise<AccountRecord> {
  const account = await requireAccount(event)
  if (account.role !== 'admin') {
    throw createError({
      statusCode: 403,
      statusMessage: 'Administrator required',
      message: '该操作仅限管理员。'
    })
  }
  return account
}

export async function requireUser(event: H3Event): Promise<AccountRecord> {
  const account = await requireAccount(event)
  if (account.role !== 'user' || !account.domainId || !account.senderEmail) {
    throw createError({
      statusCode: 403,
      statusMessage: 'User account required'
    })
  }
  return account
}

export async function logoutAccount(event: H3Event): Promise<void> {
  const token = getCookie(event, SESSION_COOKIE)
  if (token) {
    const env = useCloudflareEnv(event)
    const tokenHash = await sha256Base64Url(token)
    await env.DB.batch([
      env.DB.prepare(
        'DELETE FROM admin_sessions WHERE token_hash = ?'
      ).bind(tokenHash),
      env.DB.prepare(
        'DELETE FROM user_sessions WHERE token_hash = ?'
      ).bind(tokenHash)
    ])
  }
  deleteCookie(event, SESSION_COOKIE, { path: '/' })
}
