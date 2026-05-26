import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto'

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex')
  const hash = scryptSync(password, salt, 64)
  return `${salt}:${hash.toString('hex')}`
}

export function verifyPassword(password: string, stored: string | null | undefined): boolean {
  if (!stored) return false
  const [salt, expectedHex] = stored.split(':')
  if (!salt || !expectedHex) return false
  const attempt = scryptSync(password, salt, 64)
  const expected = Buffer.from(expectedHex, 'hex')
  if (attempt.length !== expected.length) return false
  return timingSafeEqual(attempt, expected)
}
