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
// production build sitting behind a plain-HTTP reverse proxy (e.g. Nginx with
// no TLS yet) would mark the cookie Secure and browsers silently refuse to
// store it, breaking login with no visible error. Nginx forwards the real
// scheme via X-Forwarded-Proto, so trust that instead; falls back to
// NODE_ENV when there's no proxy in front (e.g. local dev/`next start` direct).
async function isRequestSecure() {
  const proto = (await headers()).get('x-forwarded-proto')
  if (proto) return proto === 'https'
  return process.env.NODE_ENV === 'production'
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
