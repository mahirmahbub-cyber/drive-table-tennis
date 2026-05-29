import { createHmac, timingSafeEqual } from 'crypto'

const COOKIE_NAME = 'admin_session'

function sign(value: string, secret: string): string {
  return createHmac('sha256', secret).update(value).digest('hex')
}

export function makeSessionCookie(secret: string): string {
  const value = String(Date.now())
  const sig = sign(value, secret)
  return `${value}.${sig}`
}

export function verifySessionCookie(
  cookie: string | undefined,
  secret: string
): boolean {
  if (!cookie) return false
  const [value, sig] = cookie.split('.')
  if (!value || !sig) return false
  const expected = sign(value, secret)
  const a = Buffer.from(sig, 'hex')
  const b = Buffer.from(expected, 'hex')
  if (a.length !== b.length) return false
  return timingSafeEqual(a, b)
}

export const ADMIN_COOKIE = COOKIE_NAME
