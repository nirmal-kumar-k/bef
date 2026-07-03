'use server'

import { cookies } from 'next/headers'
import bcrypt from 'bcryptjs'
import { SignJWT } from 'jose'
import connectToDatabase from '@/shared/lib/mongodb'
import { User } from '@/modules/users/domain/user.model'

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'fallback_secret_for_development_only'
)

export async function loginUser(formData: FormData) {
  const email = formData.get('email') as string
  const password = formData.get('password') as string

  if (!email || !password) {
    return { error: 'Email and password are required' }
  }

  try {
    await connectToDatabase()

    const user = await User.findOne({ email }).lean()
    
    // For development: If no user exists at all in the DB, create an admin user
    // This allows the very first login to work automatically.
    const userCount = await User.countDocuments()
    if (userCount === 0) {
      console.log('No users found in database. Creating default admin user.')
      const hashedPassword = await bcrypt.hash('admin123', 10)
      const newUser = await User.create({
        name: 'Admin User',
        email: 'admin@bef.com',
        passwordHash: hashedPassword,
        role: 'admin'
      })
      
      // If this was the attempt, verify it
      if (email === 'admin@bef.com' && password === 'admin123') {
        const token = await new SignJWT({ id: newUser._id.toString(), role: newUser.role })
          .setProtectedHeader({ alg: 'HS256' })
          .setIssuedAt()
          .setExpirationTime('7d')
          .sign(JWT_SECRET)

        const cookieStore = await cookies()
        cookieStore.set('auth_token', token, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
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

    const token = await new SignJWT({ id: user._id.toString(), role: user.role })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('7d')
      .sign(JWT_SECRET)

    const cookieStore = await cookies()
    cookieStore.set('auth_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
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
}
