'use server'

import { cookies, headers } from 'next/headers'
import { redirect } from 'next/navigation'
import bcrypt from 'bcryptjs'
import { eq } from 'drizzle-orm'
import { db } from '@/infrastructure/database/client'
import { users } from '@/infrastructure/database/schema'
import { issueSession } from '@/shared/lib/auth'
import { lockedForMinutes, recordFailure, recordSuccess } from './login-throttle'

// nginx sets X-Real-IP to the connecting address, overwriting anything the
// client sent, and port 3000 is firewalled so requests can only arrive through
// nginx. Without it (local dev) every request counts as one address.
async function clientIp() {
  return (await headers()).get('x-real-ip') || 'local'
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
