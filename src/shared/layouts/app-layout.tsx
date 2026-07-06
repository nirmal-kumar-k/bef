'use client'

import { Sidebar } from '@/shared/layouts/sidebar'
import { TopBar } from '@/shared/layouts/topbar'
import { useState, useEffect } from 'react'
import { usePathname } from 'next/navigation'
import dynamic from 'next/dynamic'
import { PageTransition } from '@/shared/layouts/page-transition'

const IngotLoader = dynamic(() => import('@/shared/ui/ingot-loader').then(m => ({ default: m.IngotLoader })), { ssr: false })

export function AppLayout({ children }: { children: React.ReactNode }) {
  const [isLoading, setIsLoading] = useState(true)
  const pathname = usePathname()

  useEffect(() => {
    const timer = setTimeout(() => setIsLoading(false), 2500)
    return () => clearTimeout(timer)
  }, [])

  if (isLoading) {
    return <IngotLoader />
  }

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
      <Sidebar />
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
