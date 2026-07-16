'use client'

import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/shared/ui/dialog'
import { Button } from '@/shared/ui/button'
import { Input } from '@/shared/ui/input'
import { Label } from '@/shared/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select'
import type { AppUser } from './users-master-page'

interface UserModalProps {
  isOpen: boolean
  onClose: () => void
  initialData: AppUser | null
}

export function UserModal({ isOpen, onClose, initialData }: UserModalProps) {
  const [name, setName] = useState('')
  const [username, setUsername] = useState('')
  const [phone, setPhone] = useState('')
  const [role, setRole] = useState<AppUser['role']>('operator')
  const [password, setPassword] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (isOpen) {
      setName(initialData?.name || '')
      setUsername(initialData?.username || '')
      setPhone(initialData?.phone || '')
      setRole(initialData?.role || 'operator')
      setPassword('')
      setError('')
    }
  }, [isOpen, initialData])

  const handleSave = async () => {
    if (!name.trim() || !username.trim()) {
      setError('Name and username are required')
      return
    }
    if (!initialData && !password.trim()) {
      setError('Password is required for a new user')
      return
    }

    setIsSaving(true)
    setError('')
    try {
      const url = initialData ? `/api/users/${initialData.id}` : '/api/users'
      const method = initialData ? 'PUT' : 'POST'
      const payload: Record<string, any> = {
        name: name.trim(),
        username: username.trim(),
        phone: phone.trim() || null,
        role,
      }
      if (password.trim()) payload.password = password.trim()

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (res.ok) {
        onClose()
      } else {
        const data = await res.json().catch(() => ({}))
        setError(data.error || 'Failed to save user')
      }
    } catch (err) {
      setError('Something went wrong. Please try again.')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="bg-[#FFFFFF] border-[#E0E7FF] text-[#172554] max-w-md">
        <DialogHeader>
          <DialogTitle className="text-xl font-heading font-bold text-[#172554]">
            {initialData ? 'Edit User' : 'Add New User'}
          </DialogTitle>
        </DialogHeader>

        <div className="grid gap-5 py-4">
          <div className="grid gap-2">
            <Label htmlFor="user-name" className="text-[#64748B] text-xs font-semibold uppercase tracking-wider">Full Name</Label>
            <Input
              id="user-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Ravi Kumar"
              className="bg-[#F4F6FB] border-[#E0E7FF] focus:border-[#4F46E5] text-[#172554]"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="user-username" className="text-[#64748B] text-xs font-semibold uppercase tracking-wider">Username</Label>
              <Input
                id="user-username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="e.g. ravik"
                className="bg-[#F4F6FB] border-[#E0E7FF] focus:border-[#4F46E5] text-[#172554] font-mono"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="user-phone" className="text-[#64748B] text-xs font-semibold uppercase tracking-wider">Phone</Label>
              <Input
                id="user-phone"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="e.g. 98765 43210"
                className="bg-[#F4F6FB] border-[#E0E7FF] focus:border-[#4F46E5] text-[#172554] font-mono"
              />
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="user-role" className="text-[#64748B] text-xs font-semibold uppercase tracking-wider">Role</Label>
            <Select value={role} onValueChange={(val: any) => setRole(val)}>
              <SelectTrigger id="user-role" className="bg-[#F4F6FB] border-[#E0E7FF] focus:border-[#4F46E5] focus:ring-[#4F46E5]">
                <SelectValue placeholder="Select role" />
              </SelectTrigger>
              <SelectContent className="bg-[#FFFFFF] border-[#E0E7FF]">
                <SelectItem value="admin" className="text-[#172554] focus:bg-[#EEF2FF]">Admin</SelectItem>
                <SelectItem value="manager" className="text-[#172554] focus:bg-[#EEF2FF]">Manager</SelectItem>
                <SelectItem value="operator" className="text-[#172554] focus:bg-[#EEF2FF]">Operator</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="user-password" className="text-[#64748B] text-xs font-semibold uppercase tracking-wider">
              {initialData ? 'Reset Password' : 'Password'}
            </Label>
            <Input
              id="user-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={initialData ? 'Leave blank to keep current password' : 'Set an initial password'}
              className="bg-[#F4F6FB] border-[#E0E7FF] focus:border-[#4F46E5] text-[#172554]"
            />
          </div>

          {error && (
            <div className="text-sm font-medium text-red-600 bg-red-50 px-3 py-2 rounded-lg border border-red-200">
              {error}
            </div>
          )}
        </div>

        <DialogFooter className="mt-2">
          <Button
            variant="outline"
            onClick={onClose}
            className="border-[#E0E7FF] text-[#64748B] hover:text-[#172554] hover:bg-[#EEF2FF]"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={isSaving}
            className="bg-[#4F46E5] hover:bg-[#4F46E5]/90 text-white font-medium min-w-[100px]"
          >
            {isSaving ? 'Saving...' : 'Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
