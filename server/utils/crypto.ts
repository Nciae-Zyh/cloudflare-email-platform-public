const encoder = new TextEncoder()

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary)
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replace(/=+$/g, '')
}

function base64UrlToBytes(value: string): Uint8Array {
  const base64 = value.replaceAll('-', '+').replaceAll('_', '/')
    .padEnd(Math.ceil(value.length / 4) * 4, '=')
  const binary = atob(base64)
  return Uint8Array.from(binary, character => character.charCodeAt(0))
}

export function createSecret(prefix = ''): string {
  const bytes = new Uint8Array(32)
  crypto.getRandomValues(bytes)
  return `${prefix}${bytesToBase64Url(bytes)}`
}

export async function sha256Base64Url(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', encoder.encode(value))
  return bytesToBase64Url(new Uint8Array(digest))
}

export async function timingSafeSecretEqual(
  provided: string,
  expected: string
): Promise<boolean> {
  const [providedHash, expectedHash] = await Promise.all([
    crypto.subtle.digest('SHA-256', encoder.encode(provided)),
    crypto.subtle.digest('SHA-256', encoder.encode(expected))
  ])
  const providedBytes = new Uint8Array(providedHash)
  const expectedBytes = new Uint8Array(expectedHash)

  const subtle = crypto.subtle as SubtleCrypto & {
    timingSafeEqual?: (left: ArrayBuffer, right: ArrayBuffer) => boolean
  }
  if (typeof subtle.timingSafeEqual === 'function') {
    return subtle.timingSafeEqual(providedHash, expectedHash)
  }

  let difference = 0
  for (let index = 0; index < providedBytes.length; index += 1) {
    difference |= providedBytes[index]! ^ expectedBytes[index]!
  }
  return difference === 0
}

export async function hashPassword(
  password: string,
  salt = createSecret(),
  iterations = 100_000
): Promise<{ hash: string, salt: string, iterations: number }> {
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    'PBKDF2',
    false,
    ['deriveBits']
  )
  const bits = await crypto.subtle.deriveBits({
    name: 'PBKDF2',
    hash: 'SHA-256',
    salt: encoder.encode(salt),
    iterations
  }, key, 256)

  return {
    hash: bytesToBase64Url(new Uint8Array(bits)),
    salt,
    iterations
  }
}

export async function verifyPassword(input: {
  password: string
  expectedHash: string
  salt: string
  iterations: number
}): Promise<boolean> {
  const result = await hashPassword(input.password, input.salt, input.iterations)
  const [provided, expected] = [
    base64UrlToBytes(result.hash),
    base64UrlToBytes(input.expectedHash)
  ]
  let difference = provided.length ^ expected.length
  const length = Math.min(provided.length, expected.length)
  for (let index = 0; index < length; index += 1) {
    difference |= provided[index]! ^ expected[index]!
  }
  return difference === 0
}
