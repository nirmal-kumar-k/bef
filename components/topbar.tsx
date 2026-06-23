'use client'

import { usePathname } from 'next/navigation'

export function TopBar() {
  const pathname = usePathname()
  // Format pathname to Title
  let title = pathname.split('/').pop()?.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) || 'Dashboard'
  if (title === 'Patterns') title = 'Patterns' // or override any specific ones

  return (
    <header className="fixed md:left-64 left-0 right-0 top-0 h-[58px] bg-[#0D1220]/85 backdrop-blur-md border-b border-[#243050] z-30 flex items-center px-4 md:px-[26px] gap-4">
      
      {/* Mobile spacing adjustment since hamburger is absolute in sidebar */}
      <div className="md:hidden w-8"></div>

      <div className="flex flex-col gap-[1px]">
        <h2 className="font-heading text-[15px] font-bold text-[#EEF3FF] tracking-tight">{title}</h2>
      </div>

      <div className="w-[1px] h-5 bg-[#243050] mx-2 hidden md:block"></div>

      <div className="flex-1 max-w-[340px] relative hidden md:flex items-center">
        <svg className="absolute left-[11px] text-[#5A6E90]" width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="9" cy="9" r="5.5"/><path d="M17 17l-3.5-3.5"/></svg>
        <input 
          type="search" 
          placeholder="Search orders, patterns, customers…" 
          className="w-full bg-[#162034] border border-[#243050] rounded-md py-[7px] pr-[12px] pl-[34px] text-[13px] text-[#C4D2EE] placeholder:text-[#5A6E90] outline-none focus:border-[#E8581A]/35 focus:ring-4 focus:ring-[#E8581A]/10 transition-all"
        />
      </div>

      <div className="ml-auto flex items-center gap-[6px]">
        <div className="hidden sm:flex gap-[2px] bg-[#0D1220] border border-[#243050] rounded-md p-[3px]" title="Switch perspective">
          <button className="px-[12px] py-[5px] rounded-[4px] text-[12px] font-medium transition-all bg-[#E8581A]/20 text-[#F5712E]">Admin</button>
          <button className="px-[12px] py-[5px] rounded-[4px] text-[12px] font-medium text-[#5A6E90] hover:text-[#EEF3FF] transition-all">Customer</button>
        </div>

        <div className="relative sm:ml-2">
          <button className="w-[34px] h-[34px] rounded-md border border-[#243050] bg-transparent text-[#8B9FC4] flex items-center justify-center hover:bg-[#1C2840] hover:text-[#EEF3FF] hover:border-[#2E3C5C] transition-all relative">
            <svg width="15" height="15" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M10 2a6 6 0 016 6c0 3 1.5 4.5 1.5 4.5H2.5S4 11 4 8a6 6 0 016-6zM8.5 17a1.5 1.5 0 003 0"/></svg>
            <span className="absolute top-[5px] right-[5px] w-[7px] h-[7px] rounded-full bg-[#E8581A] border-[1.5px] border-[#0D1220]"></span>
          </button>
        </div>
      </div>
    </header>
  )
}
