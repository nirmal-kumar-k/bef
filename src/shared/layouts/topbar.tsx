'use client'

import { usePathname } from 'next/navigation'
import { MagnifyingGlass } from '@phosphor-icons/react'

export function TopBar() {
  const pathname = usePathname()

  // Format pathname to Title
  let title = pathname.split('/').pop()?.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) || 'Dashboard'
  if (title === 'Patterns') title = 'Patterns' // or override any specific ones

  return (
    <header className="fixed md:left-64 left-0 right-0 top-0 h-[58px] bg-[rgba(244,246,251,0.7)] backdrop-blur-[12px] border-b border-black/[0.04] z-30 flex items-center px-4 md:px-[26px] gap-4">
      
      {/* Mobile spacing adjustment since hamburger is absolute in sidebar */}
      <div className="md:hidden w-8"></div>

      <div className="flex flex-col gap-[1px]">
        <h2 className="font-heading text-[15px] font-bold text-[#172554] tracking-tight">{title}</h2>
      </div>

      <div className="w-[1px] h-5 bg-[#E0E7FF] mx-2 hidden md:block"></div>

      <div className="flex-1 max-w-[340px] relative hidden md:flex items-center">
        <MagnifyingGlass className="absolute left-[11px] text-[#94A3B8]" weight="duotone" size={16} />
        <input 
          type="search" 
          placeholder="Search orders, patterns, customers…" 
          className="w-full bg-[#FFFFFF] border border-[#E0E7FF] rounded-md py-[7px] pr-[12px] pl-[34px] text-[13px] text-[#0F172A] placeholder:text-[#94A3B8] outline-none focus:border-[#4F46E5]/35 focus:ring-4 focus:ring-[#4F46E5]/10 transition-all"
        />
      </div>

    </header>
  )
}
