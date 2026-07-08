import { NextRequest, NextResponse } from 'next/server'
import { verifyAuthToken } from '@/shared/lib/auth'

const PUBLIC_PATHS = ['/login']

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl
  const token = request.cookies.get('auth_token')?.value
  const payload = token ? await verifyAuthToken(token) : null

  const isPublicPath = PUBLIC_PATHS.includes(pathname)

  if (!payload && !isPublicPath) {
    const loginUrl = new URL('/login', request.url)
    return NextResponse.redirect(loginUrl)
  }

  if (payload && isPublicPath) {
    const dashboardUrl = new URL('/dashboard', request.url)
    return NextResponse.redirect(dashboardUrl)
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api).*)'],
}
