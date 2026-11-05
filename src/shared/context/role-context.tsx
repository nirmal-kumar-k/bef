'use client'

import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react'

export type Role = 'Admin' | 'Supervisor'

interface RoleContextType {
  role: Role
  setRole: (role: Role) => void
}

const RoleContext = createContext<RoleContextType | undefined>(undefined)

export function RoleProvider({ children, initialRole = 'Supervisor' }: { children: ReactNode; initialRole?: Role }) {
  const [role, setRole] = useState<Role>(initialRole)

  // The provider lives in the root layout, so it is NOT remounted when login
  // navigates client-side from /login to /dashboard - useState would keep the
  // role from the logged-out login page ('Supervisor') and hide every
  // admin-only control until a full reload. The layout re-renders on the
  // post-login router.refresh() with the real session's role; follow it.
  useEffect(() => {
    setRole(initialRole)
  }, [initialRole])

  return (
    <RoleContext.Provider value={{ role, setRole }}>
      {children}
    </RoleContext.Provider>
  )
}

export function useRole() {
  const context = useContext(RoleContext)
  if (context === undefined) {
    throw new Error('useRole must be used within a RoleProvider')
  }
  return context
}
