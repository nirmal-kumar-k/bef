import { Analytics } from '@vercel/analytics/next'
import type { Metadata, Viewport } from 'next'
import { Inter, Plus_Jakarta_Sans } from 'next/font/google'
import { AppLayout } from "@/shared/layouts/app-layout"
import { RoleProvider } from "@/shared/context/role-context"
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
  colorScheme: 'dark',
  themeColor: [
    { media: '(prefers-color-scheme: dark)', color: '#080C14' },
  ],
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" suppressHydrationWarning className={`${inter.variable} ${plusJakartaSans.variable} bg-background`}>
      <body className="font-sans antialiased" suppressHydrationWarning>
        <RoleProvider>
          <AppLayout>
            {children}
          </AppLayout>
        </RoleProvider>
        {process.env.NODE_ENV === 'production' && <Analytics />}
      </body>
    </html>
  )
}
