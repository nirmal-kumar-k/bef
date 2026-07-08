'use client'

import { Sidebar } from '@/shared/layouts/sidebar'
import { TopBar } from '@/shared/layouts/topbar'
import { useState, useEffect } from 'react'
import { usePathname } from 'next/navigation'
import dynamic from 'next/dynamic'
import { PageTransition } from '@/shared/layouts/page-transition'

const IngotLoader = dynamic(() => import('@/shared/ui/ingot-loader').then(m => ({ default: m.IngotLoader })), { ssr: false })

interface AppLayoutProps {
  children: React.ReactNode
  user: { name: string; email: string } | null
}

export function AppLayout({ children, user }: AppLayoutProps) {
  const pathname = usePathname()

  if (pathname === '/login') {
    return (
      <main className="min-h-screen bg-background">
        <PageTransition>
          {children}
        </PageTransition>
      </main>
    )
  }

  return (
    <div className="flex">
      <Sidebar user={user} />
      <div className="flex-1 md:ml-64">
        <TopBar />
        <main className="mt-[58px] p-6 min-h-screen bg-background">
          <PageTransition>
            {children}
          </PageTransition>
        </main>
      </div>
    </div>
  )
}
