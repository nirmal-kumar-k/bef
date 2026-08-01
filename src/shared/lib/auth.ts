import { jwtVerify } from 'jose'
import { cookies } from 'next/headers'

if (!process.env.JWT_SECRET) {
  throw new Error('Please define the JWT_SECRET environment variable inside .env.local')
}

export const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET)

export interface AuthTokenPayload {
  id: string
  role: string
  name: string
  username: string
}

export async function verifyAuthToken(token: string): Promise<AuthTokenPayload | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET)
    return payload as unknown as AuthTokenPayload
  } catch {
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
