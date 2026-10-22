'use server'

import { cookies, headers } from 'next/headers'
import { redirect } from 'next/navigation'
import bcrypt from 'bcryptjs'
import { SignJWT } from 'jose'
import { eq } from 'drizzle-orm'
import { db } from '@/infrastructure/database/client'
import { users } from '@/infrastructure/database/schema'
import { JWT_SECRET } from '@/shared/lib/auth'
import { lockedForMinutes, recordFailure, recordSuccess } from './login-throttle'

// nginx sets X-Real-IP to the connecting address, overwriting anything the
// client sent, and port 3000 is firewalled so requests can only arrive through
// nginx. Without it (local dev) every request counts as one address.
async function clientIp() {
  return (await headers()).get('x-real-ip') || 'local'
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

async function issueSession(user: { id: string; role: string; name: string; username: string }) {
  const token = await new SignJWT({ id: user.id, role: user.role, name: user.name, username: user.username })
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

export async function loginUser(formData: FormData) {
  const username = formData.get('username') as string
  const password = formData.get('password') as string

  if (!username || !password) {
    return { error: 'Username and password are required' }
  }

  // There is deliberately no default account: an empty users table used to
  // create admin/admin123 and sign it straight in, which on a public IP is a
  // takeover. The first admin is created with scripts/create-admin.mjs.
  const ip = await clientIp()
  const minutes = lockedForMinutes(username, ip)
  if (minutes > 0) {
    return { error: `Too many failed attempts. Try again in ${minutes} minute${minutes === 1 ? '' : 's'}.` }
  }

  try {
    const [user] = await db.select().from(users).where(eq(users.username, username))

    if (!user || !user.isActive) {
      recordFailure(username, ip)
      return { error: 'Invalid credentials' }
    }

    const isPasswordValid = await bcrypt.compare(password, user.passwordHash)
    if (!isPasswordValid) {
      recordFailure(username, ip)
      return { error: 'Invalid credentials' }
    }

    recordSuccess(username, ip)
    await issueSession(user)
    return { success: true }
  } catch (error) {
    console.error('Login error:', error)
    return { error: 'An unexpected error occurred' }
  }
}

export async function logoutUser() {
  const cookieStore = await cookies()
  cookieStore.delete('auth_token')
  redirect('/login')
}
