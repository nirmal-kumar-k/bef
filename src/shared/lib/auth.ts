import { jwtVerify, SignJWT } from 'jose'
import { cookies, headers } from 'next/headers'
import { eq } from 'drizzle-orm'
import { db } from '@/infrastructure/database/client'
import { users } from '@/infrastructure/database/schema'

if (!process.env.JWT_SECRET) {
  throw new Error('Please define the JWT_SECRET environment variable inside .env.local')
}

export const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET)

export interface AuthTokenPayload {
  id: string
  role: string
  name: string
  username: string
  // users.session_version when the token was issued. Absent on tokens issued
  // before revocation existed - treated as 1, the starting version.
  sv?: number
}

// ---- session revocation ---------------------------------------------------
// A token is only honoured while its user exists, is active, and has the same
// session_version as when it was issued. Changing a password, role or active
// flag bumps the version, ending every existing session for that user.
// Looked up per user at most every 15s (single server process), so a revoked
// session stops working within 15 seconds.

const CACHE_MS = 15_000
const g = globalThis as unknown as { befSessionCache?: Map<string, { at: number; ok: boolean; sv: number }> }
const cache = g.befSessionCache ?? (g.befSessionCache = new Map())

export function forgetSessionCache(userId: string) {
  cache.delete(userId)
}

async function isSessionCurrent(p: AuthTokenPayload): Promise<boolean> {
  const now = Date.now()
  let entry = cache.get(p.id)
  if (!entry || now - entry.at > CACHE_MS) {
    const [u] = await db.select({ isActive: users.isActive, sv: users.sessionVersion }).from(users).where(eq(users.id, p.id))
    entry = { at: now, ok: !!u && u.isActive, sv: u?.sv ?? -1 }
    cache.set(p.id, entry)
  }
  return entry.ok && entry.sv === (p.sv ?? 1)
}

export async function verifyAuthToken(token: string): Promise<AuthTokenPayload | null> {
  let payload: AuthTokenPayload
  try {
    payload = (await jwtVerify(token, JWT_SECRET)).payload as unknown as AuthTokenPayload
  } catch {
    return null
  }
  try {
    return (await isSessionCurrent(payload)) ? payload : null
  } catch (err) {
    // Database unreachable: refuse rather than wave a possibly revoked token through.
    console.error('Session check failed:', err)
    return null
  }
}

// Shared helper for Server Components/Actions/Route Handlers that need to
// know who's logged in - reads and verifies the session cookie once instead
// of every caller re-implementing the same two lines.
export async function getSessionUser(): Promise<AuthTokenPayload | null> {
  const cookieStore = await cookies()
  const token = cookieStore.get('auth_token')?.value
  if (!token) return null
  return verifyAuthToken(token)
}

// `NODE_ENV === 'production'` isn't the same thing as "served over HTTPS" - a
// production build with no reverse proxy in front (direct `next start`, e.g.
// a bare IP with no TLS) would mark the cookie Secure and browsers silently
// refuse to store it, breaking login with no visible error. Nginx (or any
// TLS-terminating proxy) forwards the real scheme via X-Forwarded-Proto, so
// trust that when present; without it, there is no positive evidence the
// connection is HTTPS, so default to non-secure rather than guessing from
// NODE_ENV. Once a real HTTPS proxy is added in front, X-Forwarded-Proto
// starts arriving and this automatically switches back to Secure cookies -
// no further code change needed then.
async function isRequestSecure() {
  const proto = (await headers()).get('x-forwarded-proto')
  return proto === 'https'
}

// Signs a session for the user and sets the cookie. Used by login, and to
// re-issue the current user's own session after they change their password.
export async function issueSession(user: { id: string; role: string; name: string; username: string; sessionVersion: number }) {
  const token = await new SignJWT({ id: user.id, role: user.role, name: user.name, username: user.username, sv: user.sessionVersion })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(JWT_SECRET)

  const cookieStore = await cookies()
  cookieStore.set('auth_token', token, {
    httpOnly: true,
    secure: await isRequestSecure(),
    sameSite: 'lax',
    path: '/',
    maxAge: 7 * 24 * 60 * 60, // 7 days
  })
}
