'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import { 
  SquaresFour, 
  ListDashes, 
  Shapes, 
  Package, 
  Users, 
  ChartBar,
  List,
  X,
  CalendarBlank,
  Factory,
  Fire,
  Wrench
} from '@phosphor-icons/react'
import { useRole } from '@/shared/context/role-context'

const navGroups = [
  {
    label: 'Operations',
    items: [
      { href: '/dashboard', label: 'Dashboard', icon: <SquaresFour weight="duotone" className="w-[18px] h-[18px] opacity-80 group-hover:opacity-100 transition-opacity" /> },
      { href: '/production-planning', label: 'Production Planning', icon: <ListDashes weight="duotone" className="w-[18px] h-[18px] opacity-80 group-hover:opacity-100 transition-opacity" /> },
      { href: '/production-schedule', label: 'Production Schedule', icon: <CalendarBlank weight="duotone" className="w-[18px] h-[18px] opacity-80 group-hover:opacity-100 transition-opacity" /> },
      { href: '/production', label: 'Production Tracking', icon: <Factory weight="duotone" className="w-[18px] h-[18px] opacity-80 group-hover:opacity-100 transition-opacity" /> },
      { href: '/orders', label: 'Sales Orders', badge: '12', icon: <ListDashes weight="duotone" className="w-[18px] h-[18px] opacity-80 group-hover:opacity-100 transition-opacity" /> },
    ]
  },
  {
    label: 'Master Data',
    items: [
      { href: '/patterns', label: 'Patterns', icon: <Shapes weight="duotone" className="w-[18px] h-[18px] opacity-80 group-hover:opacity-100 transition-opacity" /> },
      { href: '/products', label: 'Products', icon: <Package weight="duotone" className="w-[18px] h-[18px] opacity-80 group-hover:opacity-100 transition-opacity" /> },
      { href: '/customers', label: 'Customers', icon: <Users weight="duotone" className="w-[18px] h-[18px] opacity-80 group-hover:opacity-100 transition-opacity" /> },
      { href: '/grade-master', label: 'Grade Master', icon: <List weight="duotone" className="w-[18px] h-[18px] opacity-80 group-hover:opacity-100 transition-opacity" /> },
      { href: '/shift-master', label: 'Shift Master', icon: <CalendarBlank weight="duotone" className="w-[18px] h-[18px] opacity-80 group-hover:opacity-100 transition-opacity" /> },
      { href: '/equipment-master', label: 'Equipment Master', icon: <Wrench weight="duotone" className="w-[18px] h-[18px] opacity-80 group-hover:opacity-100 transition-opacity" /> },
    ]
  },

  {
    label: 'Analytics',
    items: [
      { href: '/reports', label: 'Reports', icon: <ChartBar weight="duotone" className="w-[18px] h-[18px] opacity-80 group-hover:opacity-100 transition-opacity" /> },
    ]
  }
]

export function Sidebar() {
  const pathname = usePathname()
  const [isOpen, setIsOpen] = useState(false)
  const { role } = useRole()

  const isActive = (href: string) => pathname === href

  // Filter navigation based on role
  const filteredNavGroups = navGroups.map(group => ({
    ...group,
    items: group.items
  })).filter(group => group.items.length > 0);

  return (
    <>
      {/* Mobile hamburger button */}
      <button
        className="md:hidden fixed top-3 left-4 z-50 w-[34px] h-[34px] flex items-center justify-center border border-[#E0E7FF] rounded-md text-[#64748B] bg-[#F8FAFC]"
        onClick={() => setIsOpen(!isOpen)}
      >
        {isOpen ? <X weight="bold" size={20} /> : <List weight="duotone" size={20} />}
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
        className={`fixed left-0 top-0 h-screen w-64 bg-[#F8FAFC] border-r border-[#E0E7FF] transition-transform duration-300 z-40 md:translate-x-0 flex flex-col ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Brand */}
        <div className="flex items-center gap-[14px] px-5 h-[64px] border-b border-[#E0E7FF] shrink-0">
          <svg className="w-[36px] h-[36px] shrink-0 relative" viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect width="36" height="36" rx="9" fill="#111827"/>
            <rect width="36" height="36" rx="9" fill="url(#logo-grad)" opacity="0.3"/>
            <path d="M10 8H20C22.76 8 25 10.24 25 13C25 14.56 24.27 15.94 23.14 16.87C24.27 17.79 25 19.17 25 20.72C25 23.76 22.76 26 20 26H10V8Z" fill="#FFFFFF"/>
            <path d="M13 10H19.5C20.88 10 22 11.12 22 12.5C22 13.88 20.88 15 19.5 15H13V10Z" fill="#4F46E5"/>
            <path d="M13 15H20C21.66 15 23 16.34 23 18C23 19.66 21.66 21 20 21H13V15Z" fill="#4F46E5"/>
            <rect x="10" y="27" width="16" height="2.5" rx="1.25" fill="#9B3A0C"/>
            <circle cx="29" cy="7" r="1.5" fill="#4F46E5" opacity="0.7"/>
            <circle cx="27" cy="4" r="1" fill="#4F46E5" opacity="0.5"/>
            <circle cx="32" cy="10" r="0.8" fill="#4F46E5" opacity="0.4"/>
            <defs>
              <linearGradient id="logo-grad" x1="0" y1="0" x2="36" y2="36">
                <stop offset="0%" stopColor="#4F46E5"/>
                <stop offset="100%" stopColor="#FFFFFF"/>
              </linearGradient>
            </defs>
          </svg>
          <div className="flex flex-col gap-0">
            <div className="font-heading text-[17px] font-extrabold text-[#172554] tracking-tight leading-[1.1]">BEF</div>
            <div className="text-[9.5px] font-medium text-[#94A3B8] tracking-[0.14em] uppercase">Engineering Foundry</div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto px-[10px] py-[14px] flex flex-col gap-[1px]">
          {filteredNavGroups.map((group, gIdx) => (
            <div key={gIdx} className="mb-1">
              <div className="px-[12px] pt-[14px] pb-[5px] text-[9px] font-semibold tracking-[0.16em] uppercase text-[#C7D2FE] font-heading">
                {group.label}
              </div>
              {group.items.map((item) => {
                const active = isActive(item.href)
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setIsOpen(false)}
                    className={`group flex items-center gap-[11px] px-[12px] py-[9px] rounded-[8px] text-[13.5px] transition-all duration-300 ease-in-out select-none tracking-[-0.1px] ${
                      active
                        ? 'bg-[#4F46E5]/[0.18] text-[#4F46E5] font-semibold'
                        : 'text-[#64748B] font-medium hover:bg-[#4F46E5]/[0.08] hover:text-[#4F46E5]'
                    }`}
                  >
                    <div className={`${active ? 'text-[#4F46E5]' : 'text-[#64748B] group-hover:text-[#4F46E5]'} transition-colors duration-300 ease-in-out`}>
                      {item.icon}
                    </div>
                    {item.label}
                    {item.badge && (
                      <span className="ml-auto bg-[#4F46E5] text-white text-[10px] font-bold font-heading px-[7px] py-[1px] rounded-full min-w-[20px] text-center">
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
        <div className="p-[14px_16px] border-t border-[#E0E7FF] flex items-center gap-[10px] shrink-0">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#4F46E5] to-[#9B3A0C] flex items-center justify-center font-heading text-[12px] font-bold text-white shrink-0">
            RK
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[12.5px] font-medium text-[#172554] truncate">Rajan Kumar</div>
            <div className="text-[10.5px] text-[#94A3B8]">Foundry Manager</div>
          </div>
          <svg width="13" height="13" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="text-[#C7D2FE] shrink-0"><path d="M6 8l4 4 4-4"/></svg>
        </div>
      </aside>
    </>
  )
}
