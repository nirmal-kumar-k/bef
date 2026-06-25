'use client'

import { Sidebar } from '@/shared/layouts/sidebar'
import { TopBar } from '@/shared/layouts/topbar'
import { useState, useEffect } from 'react'
import { IngotLoader } from '@/shared/ui/ingot-loader'
import { PageTransition } from '@/shared/layouts/page-transition'

export function AppLayout({ children }: { children: React.ReactNode }) {
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const timer = setTimeout(() => setIsLoading(false), 2500)
    return () => clearTimeout(timer)
  }, [])

  if (isLoading) {
    return <IngotLoader />
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
