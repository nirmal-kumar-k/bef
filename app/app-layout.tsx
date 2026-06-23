'use client'

import { Sidebar } from '@/components/sidebar'
import { TopBar } from '@/components/topbar'
import { useState, useEffect } from 'react'
import { IngotLoader } from '@/components/ingot-loader'

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
          {children}
        </main>
      </div>
    </div>
  )
}
