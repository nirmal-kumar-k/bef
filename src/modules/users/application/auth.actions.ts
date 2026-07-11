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

export async function loginUser(formData: FormData) {
  const email = formData.get('email') as string
  const password = formData.get('password') as string

  if (!email || !password) {
    return { error: 'Email and password are required' }
  }

  try {
    const [user] = await db.select().from(users).where(eq(users.email, email))

    // For development: If no user exists at all in the DB, create an admin user
    // This allows the very first login to work automatically.
    const [{ value: userCount }] = await db.select({ value: count() }).from(users)
    if (userCount === 0) {
      console.log('No users found in database. Creating default admin user.')
      const hashedPassword = await bcrypt.hash('admin123', 10)
      const [newUser] = await db.insert(users).values({
        name: 'Admin User',
        email: 'admin@bef.com',
        passwordHash: hashedPassword,
        role: 'admin'
      }).returning()

      // If this was the attempt, verify it
      if (email === 'admin@bef.com' && password === 'admin123') {
        const token = await new SignJWT({ id: newUser.id, role: newUser.role, name: newUser.name, email: newUser.email })
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

        return { success: true }
      }
    }

    if (!user) {
      return { error: 'Invalid credentials' }
    }

    const isPasswordValid = await bcrypt.compare(password, user.passwordHash)
    if (!isPasswordValid) {
      return { error: 'Invalid credentials' }
    }

    const token = await new SignJWT({ id: user.id, role: user.role, name: user.name, email: user.email })
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
