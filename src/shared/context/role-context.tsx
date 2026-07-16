'use client'

import React, { createContext, useContext, useState, ReactNode } from 'react'

export type Role = 'Admin' | 'Supervisor'

interface RoleContextType {
  role: Role
  setRole: (role: Role) => void
}

const RoleContext = createContext<RoleContextType | undefined>(undefined)

export function RoleProvider({ children, initialRole = 'Supervisor' }: { children: ReactNode; initialRole?: Role }) {
  const [role, setRole] = useState<Role>(initialRole)

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
