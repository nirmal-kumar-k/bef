import { cookies } from 'next/headers'
import { Analytics } from '@vercel/analytics/next'
import type { Metadata, Viewport } from 'next'
import { Inter, Plus_Jakarta_Sans } from 'next/font/google'
import { AppLayout } from "@/shared/layouts/app-layout"
import { RoleProvider } from "@/shared/context/role-context"
import { AppProvider } from "@/application/store/provider"
import { verifyAuthToken } from '@/shared/lib/auth'
import './globals.css'

const inter = Inter({ variable: '--font-inter', subsets: ['latin'] })
const plusJakartaSans = Plus_Jakarta_Sans({ variable: '--font-plus-jakarta', subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'BEF Foundry | Advanced Metalworks Management',
  description: 'Complete foundry management system for production planning, inventory, and operations',
  generator: 'v0.app',
  icons: {
    icon: [
      {
        url: '/icon-light-32x32.png',
        media: '(prefers-color-scheme: light)',
      },
      {
        url: '/icon-dark-32x32.png',
        media: '(prefers-color-scheme: dark)',
      },
      {
        url: '/icon.svg',
        type: 'image/svg+xml',
      },
    ],
    apple: '/apple-icon.png',
  },
}

export const viewport: Viewport = {
  colorScheme: 'light',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#F4F6FB' },
  ],
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const cookieStore = await cookies()
  const token = cookieStore.get('auth_token')?.value
  const authUser = token ? await verifyAuthToken(token) : null
  const user = authUser ? { name: authUser.name, email: authUser.email } : null

  return (
    <html lang="en" suppressHydrationWarning className={`${inter.variable} ${plusJakartaSans.variable} bg-background`}>
      <body className="font-sans antialiased" suppressHydrationWarning>
        <AppProvider>
          <RoleProvider>
            <AppLayout user={user}>
              {children}
            </AppLayout>
          </RoleProvider>
        </AppProvider>
        {process.env.NODE_ENV === 'production' && <Analytics />}
      </body>
    </html>
  )
}
