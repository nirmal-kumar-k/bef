'use client'

import { Sidebar } from '@/shared/layouts/sidebar'
import { TopBar } from '@/shared/layouts/topbar'
import { usePathname } from 'next/navigation'

interface AppLayoutProps {
  children: React.ReactNode
  user: { name: string; email: string } | null
}

export function AppLayout({ children, user }: AppLayoutProps) {
  const pathname = usePathname()

  if (pathname === '/login') {
    return (
      <main className="min-h-screen bg-background">
        {children}
      </main>
    )
  }

  return (
    <div className="flex">
      <Sidebar user={user} />
      <div className="flex-1 md:ml-64">
        <TopBar />
        <main className="mt-[58px] p-6 min-h-screen bg-background">
          {children}
        </main>
      </div>
    </div>
  )
}
