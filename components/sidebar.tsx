'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Menu, X } from 'lucide-react'
import { useState } from 'react'

const navGroups = [
  {
    label: 'Operations',
    items: [
      { href: '/dashboard', label: 'Dashboard', icon: (
        <svg className="w-[17px] h-[17px] opacity-80 group-hover:opacity-100 transition-opacity" viewBox="0 0 20 20" fill="currentColor">
          <rect x="2" y="2" width="7" height="7" rx="1.5" />
          <rect x="11" y="2" width="7" height="7" rx="1.5" />
          <rect x="2" y="11" width="7" height="7" rx="1.5" />
          <rect x="11" y="11" width="7" height="7" rx="1.5" />
        </svg>
      )},
      { href: '/orders', label: 'Orders', badge: '12', icon: (
        <svg className="w-[17px] h-[17px] opacity-80 group-hover:opacity-100 transition-opacity" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 5h14M3 10h14M3 15h8"/><circle cx="16.5" cy="15" r="2.5"/><path d="M15.5 15h1.5v-1.5"/>
        </svg>
      )},
    ]
  },
  {
    label: 'Master Data',
    items: [
      { href: '/patterns', label: 'Patterns', icon: (
        <svg className="w-[17px] h-[17px] opacity-80 group-hover:opacity-100 transition-opacity" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="10" cy="10" r="3"/><path d="M10 3v2M10 15v2M3 10h2M15 10h2M5.05 5.05l1.41 1.41M13.54 13.54l1.41 1.41M5.05 14.95l1.41-1.41M13.54 6.46l1.41-1.41"/>
        </svg>
      )},
      { href: '/products', label: 'Products', icon: (
        <svg className="w-[17px] h-[17px] opacity-80 group-hover:opacity-100 transition-opacity" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
          <path d="M16 8V5a1 1 0 00-1-1H5a1 1 0 00-1 1v3"/><rect x="2" y="8" width="16" height="10" rx="1.5"/><path d="M8 12h4"/>
        </svg>
      )},
      { href: '/customers', label: 'Customers', icon: (
        <svg className="w-[17px] h-[17px] opacity-80 group-hover:opacity-100 transition-opacity" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="8" cy="7" r="3"/><path d="M2 17c0-3 2.686-5 6-5"/><circle cx="15" cy="12" r="2.5"/><path d="M12.5 17h5"/>
        </svg>
      )},
    ]
  },
  {
    label: 'Analytics',
    items: [
      { href: '/reports', label: 'Reports', icon: (
        <svg className="w-[17px] h-[17px] opacity-80 group-hover:opacity-100 transition-opacity" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 16V10M8 16V6M12 16v-3M16 16V8"/>
        </svg>
      )},
    ]
  }
]

export function Sidebar() {
  const pathname = usePathname()
  const [isOpen, setIsOpen] = useState(false)

  const isActive = (href: string) => pathname === href

  return (
    <>
      {/* Mobile hamburger button */}
      <button
        className="md:hidden fixed top-3 left-4 z-50 w-[34px] h-[34px] flex items-center justify-center border border-[#243050] rounded-md text-[#8B9FC4] bg-[#0D1220]"
        onClick={() => setIsOpen(!isOpen)}
      >
        {isOpen ? <X className="size-5" /> : <Menu className="size-5" />}
      </button>

      {/* Sidebar overlay for mobile */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 md:hidden z-40 backdrop-blur-sm"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed left-0 top-0 h-screen w-64 bg-[#0D1220] border-r border-[#243050] transition-transform duration-300 z-40 md:translate-x-0 flex flex-col ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Brand */}
        <div className="flex items-center gap-[14px] px-5 h-[64px] border-b border-[#243050] shrink-0">
          <svg className="w-[36px] h-[36px] shrink-0 relative" viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect width="36" height="36" rx="9" fill="#111827"/>
            <rect width="36" height="36" rx="9" fill="url(#logo-grad)" opacity="0.3"/>
            <path d="M10 8H20C22.76 8 25 10.24 25 13C25 14.56 24.27 15.94 23.14 16.87C24.27 17.79 25 19.17 25 20.72C25 23.76 22.76 26 20 26H10V8Z" fill="#162034"/>
            <path d="M13 10H19.5C20.88 10 22 11.12 22 12.5C22 13.88 20.88 15 19.5 15H13V10Z" fill="#E8581A"/>
            <path d="M13 15H20C21.66 15 23 16.34 23 18C23 19.66 21.66 21 20 21H13V15Z" fill="#F5712E"/>
            <rect x="10" y="27" width="16" height="2.5" rx="1.25" fill="#9B3A0C"/>
            <circle cx="29" cy="7" r="1.5" fill="#E8581A" opacity="0.7"/>
            <circle cx="27" cy="4" r="1" fill="#F5712E" opacity="0.5"/>
            <circle cx="32" cy="10" r="0.8" fill="#E8581A" opacity="0.4"/>
            <defs>
              <linearGradient id="logo-grad" x1="0" y1="0" x2="36" y2="36">
                <stop offset="0%" stopColor="#E8581A"/>
                <stop offset="100%" stopColor="#162034"/>
              </linearGradient>
            </defs>
          </svg>
          <div className="flex flex-col gap-0">
            <div className="font-heading text-[17px] font-extrabold text-[#EEF3FF] tracking-tight leading-[1.1]">BEF</div>
            <div className="text-[9.5px] font-medium text-[#5A6E90] tracking-[0.14em] uppercase">Engineering Foundry</div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto px-[10px] py-[14px] flex flex-col gap-[1px]">
          {navGroups.map((group, gIdx) => (
            <div key={gIdx} className="mb-1">
              <div className="px-[12px] pt-[14px] pb-[5px] text-[9px] font-semibold tracking-[0.16em] uppercase text-[#3A4A68] font-heading">
                {group.label}
              </div>
              {group.items.map((item) => {
                const active = isActive(item.href)
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setIsOpen(false)}
                    className={`group flex items-center gap-[11px] px-[12px] py-[9px] rounded-[10px] text-[13.5px] transition-all border border-transparent select-none tracking-[-0.1px] ${
                      active
                        ? 'bg-[#E8581A]/20 border-[#E8581A]/35 text-[#F5712E] font-medium'
                        : 'text-[#8B9FC4] font-normal hover:bg-[#1C2840] hover:text-[#EEF3FF]'
                    }`}
                  >
                    <div className={`${active ? 'text-[#F5712E]' : 'text-[#8B9FC4] group-hover:text-[#EEF3FF]'} transition-colors`}>
                      {item.icon}
                    </div>
                    {item.label}
                    {item.badge && (
                      <span className="ml-auto bg-[#E8581A] text-white text-[10px] font-bold font-heading px-[7px] py-[1px] rounded-full min-w-[20px] text-center">
                        {item.badge}
                      </span>
                    )}
                  </Link>
                )
              })}
            </div>
          ))}
        </nav>

        {/* Sidebar Foot */}
        <div className="p-[14px_16px] border-t border-[#243050] flex items-center gap-[10px] shrink-0">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#E8581A] to-[#9B3A0C] flex items-center justify-center font-heading text-[12px] font-bold text-white shrink-0">
            RK
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[12.5px] font-medium text-[#EEF3FF] truncate">Rajan Kumar</div>
            <div className="text-[10.5px] text-[#5A6E90]">Foundry Manager</div>
          </div>
          <svg width="13" height="13" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="text-[#3A4A68] shrink-0"><path d="M6 8l4 4 4-4"/></svg>
        </div>
      </aside>
    </>
  )
}
