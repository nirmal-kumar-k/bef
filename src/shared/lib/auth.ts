import { jwtVerify } from 'jose'

export const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'fallback_secret_for_development_only'
)

export interface AuthTokenPayload {
  id: string
  role: string
  name: string
  email: string
}

export async function verifyAuthToken(token: string): Promise<AuthTokenPayload | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET)
    return payload as unknown as AuthTokenPayload
  } catch {
    return null
  }
}
