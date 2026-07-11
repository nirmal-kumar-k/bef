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
import { Textarea } from '@/shared/ui/textarea'
import { Switch } from '@/shared/ui/switch'
import { Buildings } from '@phosphor-icons/react'

export interface Customer {
  id?: string
  value: string // Code
  label: string // Name
  email: string
  phone: string
  contactPerson: string
  address: string
  status: string
}

const EMPTY_CUSTOMER: Customer = {
  value: '',
  label: '',
  email: '',
  phone: '',
  contactPerson: '',
  address: '',
  status: 'Active',
}

interface CustomerModalProps {
  isOpen: boolean
  onClose: () => void
  initialData: Customer | null
  onSaved: () => void
}

export function CustomerModal({ isOpen, onClose, initialData, onSaved }: CustomerModalProps) {
  const [formData, setFormData] = useState<Customer>(EMPTY_CUSTOMER)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (isOpen) {
      setFormData(initialData || EMPTY_CUSTOMER)
      setError('')
    }
  }, [isOpen, initialData])

  const handleSave = async () => {
    if (!formData.label.trim() || !formData.value.trim()) {
      setError('Customer name and code are required.')
      return
    }

    setIsSaving(true)
    setError('')
    try {
      const url = formData.id ? `/api/customers/${formData.id}` : '/api/customers'
      const method = formData.id ? 'PUT' : 'POST'

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...formData, value: formData.value.trim().toUpperCase() }),
      })

      if (res.ok) {
        onSaved()
        onClose()
      } else {
        const data = await res.json().catch(() => ({}))
        setError(data.error || 'Failed to save customer.')
      }
    } catch (err) {
      console.error('Error saving customer:', err)
      setError('Failed to save customer.')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="bg-[#FFFFFF] border-[#E0E7FF] text-[#172554] max-w-lg">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#EEF2FF] flex items-center justify-center shrink-0">
              <Buildings weight="duotone" className="w-5 h-5 text-[#4F46E5]" />
            </div>
            <DialogTitle className="text-xl font-heading font-bold text-[#172554]">
              {initialData ? 'Edit Customer' : 'Add New Customer'}
            </DialogTitle>
          </div>
        </DialogHeader>

        <div className="grid gap-5 py-2">
          <div className="grid grid-cols-3 gap-4">
            <div className="col-span-2 grid gap-2">
              <Label htmlFor="label" className="text-[#64748B] text-xs font-semibold uppercase tracking-wider">Customer Name</Label>
              <Input
                id="label"
                value={formData.label}
                onChange={(e) => setFormData(prev => ({ ...prev, label: e.target.value }))}
                placeholder="e.g. Aspire Metalworks Pvt Ltd"
                className="bg-[#F4F6FB] border-[#E0E7FF] focus:border-[#4F46E5] text-[#172554]"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="value" className="text-[#64748B] text-xs font-semibold uppercase tracking-wider">Code</Label>
              <Input
                id="value"
                value={formData.value}
                onChange={(e) => setFormData(prev => ({ ...prev, value: e.target.value.toUpperCase() }))}
                placeholder="e.g. ASPIRE"
                className="bg-[#F4F6FB] border-[#E0E7FF] focus:border-[#4F46E5] text-[#172554] font-mono uppercase"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="email" className="text-[#64748B] text-xs font-semibold uppercase tracking-wider">Email</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                placeholder="e.g. accounts@aspire.com"
                className="bg-[#F4F6FB] border-[#E0E7FF] focus:border-[#4F46E5] text-[#172554]"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="phone" className="text-[#64748B] text-xs font-semibold uppercase tracking-wider">Phone</Label>
              <Input
                id="phone"
                value={formData.phone}
                onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                placeholder="e.g. +91 98765 43210"
                className="bg-[#F4F6FB] border-[#E0E7FF] focus:border-[#4F46E5] text-[#172554] font-mono"
              />
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="contactPerson" className="text-[#64748B] text-xs font-semibold uppercase tracking-wider">Contact Person</Label>
            <Input
              id="contactPerson"
              value={formData.contactPerson}
              onChange={(e) => setFormData(prev => ({ ...prev, contactPerson: e.target.value }))}
              placeholder="e.g. Ramesh Kumar"
              className="bg-[#F4F6FB] border-[#E0E7FF] focus:border-[#4F46E5] text-[#172554]"
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="address" className="text-[#64748B] text-xs font-semibold uppercase tracking-wider">Address</Label>
            <Textarea
              id="address"
              value={formData.address}
              onChange={(e) => setFormData(prev => ({ ...prev, address: e.target.value }))}
              placeholder="e.g. Plot 12, Industrial Estate, Coimbatore"
              className="bg-[#F4F6FB] border-[#E0E7FF] focus:border-[#4F46E5] text-[#172554] min-h-[70px] resize-none"
            />
          </div>

          <div className="flex items-center justify-between bg-[#F4F6FB] border border-[#E0E7FF] rounded-lg px-4 py-3">
            <div>
              <Label className="text-[#172554] text-sm font-semibold">Active Customer</Label>
              <p className="text-[#94A3B8] text-xs mt-0.5">Inactive customers are hidden from order/pattern pickers.</p>
            </div>
            <Switch
              checked={formData.status === 'Active'}
              onCheckedChange={(checked) => setFormData(prev => ({ ...prev, status: checked ? 'Active' : 'Inactive' }))}
              className="data-[state=checked]:bg-[#10B981]"
            />
          </div>

          {error && (
            <p className="text-sm text-red-500 font-medium">{error}</p>
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
            disabled={!formData.label.trim() || !formData.value.trim() || isSaving}
            className="bg-[#4F46E5] hover:bg-[#4F46E5]/90 text-white font-medium min-w-[100px]"
          >
            {isSaving ? 'Saving...' : 'Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
