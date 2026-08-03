import { NextRequest, NextResponse } from 'next/server'
import { verifyAuthToken } from '@/shared/lib/auth'

const PUBLIC_PATHS = ['/login']
const ADMIN_ONLY_PATHS = ['/users']

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl
  const token = request.cookies.get('auth_token')?.value
  const payload = token ? await verifyAuthToken(token) : null

  const isApiPath = pathname.startsWith('/api')
  const isPublicPath = PUBLIC_PATHS.includes(pathname)

  if (!payload && isApiPath) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (!payload && !isPublicPath) {
    const loginUrl = new URL('/login', request.url)
    return NextResponse.redirect(loginUrl)
  }

  if (payload && isPublicPath) {
    const dashboardUrl = new URL('/dashboard', request.url)
    return NextResponse.redirect(dashboardUrl)
  }

  if (payload && payload.role !== 'admin' && ADMIN_ONLY_PATHS.includes(pathname)) {
    const dashboardUrl = new URL('/dashboard', request.url)
    return NextResponse.redirect(dashboardUrl)
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
