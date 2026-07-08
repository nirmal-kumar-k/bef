'use client'

import { Sidebar } from '@/shared/layouts/sidebar'
import { TopBar } from '@/shared/layouts/topbar'
import { useState, useEffect, useRef } from 'react'
import { usePathname } from 'next/navigation'
import dynamic from 'next/dynamic'

const IngotLoader = dynamic(() => import('@/shared/ui/ingot-loader').then(m => ({ default: m.IngotLoader })), { ssr: false })

interface AppLayoutProps {
  children: React.ReactNode
  user: { name: string; email: string } | null
}

export function AppLayout({ children, user }: AppLayoutProps) {
  const [isLoading, setIsLoading] = useState(true)
  const pathname = usePathname()
  const prevPathRef = useRef(pathname)

  useEffect(() => {
    if (isLoading) {
      const timer = setTimeout(() => setIsLoading(false), 2500)
      return () => clearTimeout(timer)
    }
  }, [isLoading])

  useEffect(() => {
    if (prevPathRef.current === '/login' && pathname !== '/login') {
      setIsLoading(true)
    }
    prevPathRef.current = pathname
  }, [pathname])

  if (isLoading) {
    return <IngotLoader />
  }

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
