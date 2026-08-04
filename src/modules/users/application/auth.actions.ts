'use server'

import { cookies, headers } from 'next/headers'
import { redirect } from 'next/navigation'
import bcrypt from 'bcryptjs'
import { SignJWT } from 'jose'
import { eq, count } from 'drizzle-orm'
import { db } from '@/infrastructure/database/client'
import { users } from '@/infrastructure/database/schema'
import { JWT_SECRET } from '@/shared/lib/auth'

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

  try {
    // For development: if no user exists at all in the DB, create a default
    // admin so the very first login works without a manual seed step.
    const [{ value: userCount }] = await db.select({ value: count() }).from(users)
    if (userCount === 0) {
      console.log('No users found in database. Creating default admin user.')
      const hashedPassword = await bcrypt.hash('admin123', 10)
      const [newUser] = await db.insert(users).values({
        name: 'Admin User',
        username: 'admin',
        passwordHash: hashedPassword,
        role: 'admin'
      }).returning()

      if (username === 'admin' && password === 'admin123') {
        await issueSession(newUser)
        return { success: true }
      }
    }

    const [user] = await db.select().from(users).where(eq(users.username, username))

    if (!user || !user.isActive) {
      return { error: 'Invalid credentials' }
    }

    const isPasswordValid = await bcrypt.compare(password, user.passwordHash)
    if (!isPasswordValid) {
      return { error: 'Invalid credentials' }
    }

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
