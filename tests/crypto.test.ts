import { describe, expect, it } from 'vitest'
import {
  createSecret,
  hashPassword,
  sha256Base64Url,
  timingSafeSecretEqual,
  verifyPassword
} from '../server/utils/crypto'

describe('credential helpers', () => {
  it('creates high-entropy prefixed secrets', () => {
    const first = createSecret('cmp_live_')
    const second = createSecret('cmp_live_')
    expect(first).toMatch(/^cmp_live_[A-Za-z0-9_-]{40,}$/)
    expect(first).not.toBe(second)
  })

  it('hashes and verifies passwords with PBKDF2', async () => {
    const password = await hashPassword('correct horse battery staple', undefined, 10_000)
    await expect(verifyPassword({
      password: 'correct horse battery staple',
      expectedHash: password.hash,
      salt: password.salt,
      iterations: password.iterations
    })).resolves.toBe(true)
    await expect(verifyPassword({
      password: 'wrong password',
      expectedHash: password.hash,
      salt: password.salt,
      iterations: password.iterations
    })).resolves.toBe(false)
  })

  it('compares fixed-length secret digests', async () => {
    expect(await timingSafeSecretEqual('same', 'same')).toBe(true)
    expect(await timingSafeSecretEqual('same', 'different')).toBe(false)
    expect(await sha256Base64Url('secret')).not.toContain('secret')
  })
})
