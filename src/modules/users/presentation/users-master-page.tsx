'use client'

import { useState, useEffect } from 'react'
import { Plus, PencilSimple, Trash } from '@phosphor-icons/react'
import { Button } from '@/shared/ui/button'
import { Switch } from '@/shared/ui/switch'
import { UserModal } from './user-modal'
import { cn } from '@/shared/lib/utils'

export interface AppUser {
  id?: string
  name: string
  username: string
  phone?: string | null
  role: 'admin' | 'manager' | 'operator'
  isActive: boolean
  createdAt?: string
}

const ROLE_BADGE: Record<AppUser['role'], string> = {
  admin: 'bg-[#4F46E5]/10 text-[#4F46E5] border-[#4F46E5]/20',
  manager: 'bg-[#0EA5E9]/10 text-[#0EA5E9] border-[#0EA5E9]/20',
  operator: 'bg-[#94A3B8]/10 text-[#64748B] border-[#94A3B8]/20',
}

export function UsersMasterPage() {
  const [userList, setUserList] = useState<AppUser[]>([])
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [selectedUser, setSelectedUser] = useState<AppUser | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState('')

  const fetchUsers = async () => {
    try {
      setIsLoading(true)
      const res = await fetch('/api/users')
      if (res.ok) {
        setUserList(await res.json())
      } else if (res.status === 403) {
        setErrorMessage('Only admins can manage users.')
      }
    } catch (error) {
      console.error('Failed to fetch users:', error)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchUsers()
  }, [])

  const handleEdit = (user: AppUser) => {
    setSelectedUser(user)
    setIsModalOpen(true)
  }

  const handleDelete = async (user: AppUser) => {
    if (!confirm(`Delete user "${user.name}"? This cannot be undone.`)) return

    try {
      const res = await fetch(`/api/users/${user.id}`, { method: 'DELETE' })
      if (res.ok) {
        fetchUsers()
      } else {
        const data = await res.json().catch(() => ({}))
        alert(data.error || 'Failed to delete user')
      }
    } catch (error) {
      console.error('Failed to delete user:', error)
    }
  }

  const toggleActive = async (user: AppUser) => {
    try {
      const res = await fetch(`/api/users/${user.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !user.isActive })
      })
      if (res.ok) fetchUsers()
    } catch (error) {
      console.error('Failed to toggle user:', error)
    }
  }

  if (errorMessage) {
    return (
      <div className="p-8 max-w-6xl mx-auto">
        <div className="p-12 text-center text-[#94A3B8] italic bg-[#F4F6FB] border border-[#E0E7FF] rounded-xl">
          {errorMessage}
        </div>
      </div>
    )
  }

  return (
    <div className="p-4 sm:p-8 max-w-6xl mx-auto animate-in fade-in duration-300 ease-out">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-[#172554] tracking-tight font-heading">Users</h1>
          <p className="text-sm text-[#64748B] mt-1">Manage who can sign in and what they can do</p>
        </div>
        <Button
          onClick={() => {
            setSelectedUser(null)
            setIsModalOpen(true)
          }}
          className="bg-[#4F46E5] hover:bg-[#4F46E5]/90 text-white font-medium w-full sm:w-auto"
        >
          <Plus weight="bold" className="mr-2" />
          Add User
        </Button>
      </div>

      <div className="bg-[#F4F6FB] border border-[#E0E7FF] rounded-xl overflow-hidden shadow-xl">
        {isLoading ? (
          <div className="p-12 text-center text-[#94A3B8] animate-pulse">Loading...</div>
        ) : userList.length === 0 ? (
          <div className="p-12 text-center text-[#94A3B8] italic">
            No users yet. Click &quot;Add User&quot; to create one.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-[#FFFFFF] text-[#64748B] font-semibold text-xs uppercase tracking-wider border-b border-[#E0E7FF]">
                <tr>
                  <th className="px-6 py-4">Name</th>
                  <th className="px-6 py-4">Username</th>
                  <th className="px-6 py-4">Phone</th>
                  <th className="px-6 py-4 text-center">Role</th>
                  <th className="px-6 py-4 text-center">Status</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E0E7FF]">
                {userList.map((user) => (
                  <tr key={user.id} className={cn("group hover:bg-[#FFFFFF]/50 transition-colors", !user.isActive && "opacity-50")}>
                    <td className="px-6 py-4">
                      <div className="font-medium text-[#172554]">{user.name}</div>
                    </td>
                    <td className="px-6 py-4 text-[#64748B] font-mono">@{user.username}</td>
                    <td className="px-6 py-4 text-[#64748B] font-mono">{user.phone || '-'}</td>
                    <td className="px-6 py-4 text-center">
                      <span className={cn("text-xs font-semibold px-2 py-0.5 rounded-full border capitalize", ROLE_BADGE[user.role])}>
                        {user.role}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <span className={cn(
                          "text-xs font-semibold px-2 py-0.5 rounded-full border",
                          user.isActive
                            ? "bg-[#10B981]/10 text-[#10B981] border-[#10B981]/20"
                            : "bg-[#94A3B8]/10 text-[#94A3B8] border-[#94A3B8]/20"
                        )}>
                          {user.isActive ? 'Active' : 'Inactive'}
                        </span>
                        <Switch
                          checked={user.isActive}
                          onCheckedChange={() => toggleActive(user)}
                          className="data-checked:bg-[#10B981]"
                        />
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleEdit(user)}
                          className="h-8 w-8 text-[#64748B] hover:text-[#172554] hover:bg-[#E0E7FF]"
                        >
                          <PencilSimple weight="bold" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(user)}
                          className="h-8 w-8 text-[#64748B] hover:text-red-400 hover:bg-red-400/10"
                        >
                          <Trash weight="bold" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <UserModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false)
          fetchUsers()
        }}
        initialData={selectedUser}
      />
    </div>
  )
}
