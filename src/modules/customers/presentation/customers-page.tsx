'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { Buildings, EnvelopeSimple, Phone, MapPin, User, Plus, PencilSimple, Trash, MagnifyingGlass } from '@phosphor-icons/react'
import { Button } from '@/shared/ui/button'
import { Input } from '@/shared/ui/input'
import { ConfirmDeleteDialog } from '@/shared/ui/confirm-delete-dialog'
import { useRole } from '@/shared/context/role-context'
import { cn } from '@/shared/lib/utils'
import { CustomerModal, Customer } from './customer-modal'

export default function CustomersPage() {
  const { role } = useRole()
  const [customers, setCustomers] = useState<Customer[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  const [isModalOpen, setIsModalOpen] = useState(false)
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Customer | null>(null)

  const fetchCustomers = useCallback(async () => {
    try {
      const res = await fetch('/api/customers?detailed=true')
      const data = await res.json()
      setCustomers(data)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchCustomers()
  }, [fetchCustomers])

  const filteredCustomers = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return customers
    return customers.filter(c =>
      c.label.toLowerCase().includes(q) ||
      c.value.toLowerCase().includes(q) ||
      c.contactPerson?.toLowerCase().includes(q) ||
      c.email?.toLowerCase().includes(q)
    )
  }, [customers, search])

  const handleAdd = () => {
    setSelectedCustomer(null)
    setIsModalOpen(true)
  }

  const handleEdit = (customer: Customer) => {
    setSelectedCustomer(customer)
    setIsModalOpen(true)
  }

  const handleDelete = async () => {
    if (!deleteTarget?.id) return
    try {
      const res = await fetch(`/api/customers/${deleteTarget.id}`, { method: 'DELETE' })
      if (res.ok) fetchCustomers()
    } catch (err) {
      console.error('Failed to delete customer:', err)
    }
  }

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto py-12 flex flex-col items-center justify-center">
        <div className="w-8 h-8 border-2 border-[#E0E7FF] border-t-[#4F46E5] rounded-full animate-spin mb-4" />
        <p className="text-[#64748B] text-sm">Loading customers...</p>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6 animate-in fade-in duration-300 ease-out">
      <div className="flex items-center justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-3xl font-heading font-extrabold text-[#172554] tracking-tight">Customer Directory</h1>
          <p className="text-[#64748B] text-sm">Manage the customers used across orders and patterns.</p>
        </div>
        <Button onClick={handleAdd} className="bg-[#4F46E5] hover:bg-[#4F46E5]/90 text-white font-medium shrink-0">
          <Plus weight="bold" className="mr-2 w-4 h-4" />
          New Customer
        </Button>
      </div>

      <div className="relative max-w-sm">
        <MagnifyingGlass className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#94A3B8]" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name, code, or contact..."
          className="pl-9 bg-[#FFFFFF] border-[#E0E7FF] focus:border-[#4F46E5] text-[#172554]"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {filteredCustomers.length === 0 ? (
          <div className="col-span-full py-16 text-center text-[#94A3B8] bg-[#F4F6FB] border border-dashed border-[#E0E7FF] rounded-2xl">
            {search ? 'No customers match your search.' : 'No customers yet. Click "New Customer" to add one.'}
          </div>
        ) : (
          filteredCustomers.map(customer => {
            const isActive = customer.status === 'Active'
            return (
              <div
                key={customer.id}
                className="group relative bg-white border border-[#E0E7FF] rounded-2xl overflow-hidden shadow-[0_1px_3px_rgba(0,0,0,0.02)] hover:border-[#C7D2FE] hover:shadow-[0_8px_24px_-4px_rgba(79,70,229,0.16)] hover:-translate-y-[2px] transition-all duration-300 ease-out"
              >
                {/* Card header */}
                <div className="p-5 pb-4 bg-gradient-to-br from-[#F8FAFC] to-white border-b border-[#E0E7FF] flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-11 h-11 rounded-xl bg-[#EEF2FF] flex items-center justify-center shrink-0">
                      <Buildings weight="duotone" className="w-5 h-5 text-[#4F46E5]" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-bold text-[#172554] leading-tight truncate">{customer.label}</h3>
                      <span className="font-mono text-[10px] font-bold tracking-widest uppercase text-[#4F46E5] bg-[#EEF2FF] px-1.5 py-0.5 rounded mt-1 inline-block">
                        {customer.value}
                      </span>
                    </div>
                  </div>
                  <span className={cn(
                    "text-[10px] font-bold tracking-wider uppercase px-2 py-1 rounded-md border shrink-0",
                    isActive
                      ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20"
                      : "bg-[#94A3B8]/10 text-[#94A3B8] border-[#94A3B8]/20"
                  )}>
                    {customer.status || 'Active'}
                  </span>
                </div>

                {/* Card body */}
                <div className="p-5 space-y-2.5">
                  <div className="flex items-center gap-3 text-[#64748B] text-sm">
                    <div className="w-6 h-6 rounded-md bg-[#F4F6FB] flex items-center justify-center shrink-0">
                      <User className="w-3.5 h-3.5" weight="duotone" />
                    </div>
                    <span className="truncate">{customer.contactPerson || 'No contact set'}</span>
                  </div>
                  <div className="flex items-center gap-3 text-[#64748B] text-sm">
                    <div className="w-6 h-6 rounded-md bg-[#F4F6FB] flex items-center justify-center shrink-0">
                      <EnvelopeSimple className="w-3.5 h-3.5" weight="duotone" />
                    </div>
                    <span className="truncate">{customer.email || 'N/A'}</span>
                  </div>
                  <div className="flex items-center gap-3 text-[#64748B] text-sm">
                    <div className="w-6 h-6 rounded-md bg-[#F4F6FB] flex items-center justify-center shrink-0">
                      <Phone className="w-3.5 h-3.5" weight="duotone" />
                    </div>
                    <span className="truncate">{customer.phone || 'N/A'}</span>
                  </div>
                  <div className="flex items-start gap-3 text-[#64748B] text-sm">
                    <div className="w-6 h-6 rounded-md bg-[#F4F6FB] flex items-center justify-center shrink-0 mt-0.5">
                      <MapPin className="w-3.5 h-3.5" weight="duotone" />
                    </div>
                    <span className="line-clamp-2 leading-relaxed">{customer.address || 'N/A'}</span>
                  </div>
                </div>

                {/* Card actions */}
                <div className="flex border-t border-[#E0E7FF]">
                  <button
                    onClick={() => handleEdit(customer)}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-semibold text-[#4F46E5] hover:bg-[#EEF2FF] transition-colors"
                  >
                    <PencilSimple weight="bold" className="w-3.5 h-3.5" />
                    Edit
                  </button>
                  {role === 'Admin' && (
                    <>
                      <div className="w-[1px] bg-[#E0E7FF]" />
                      <button
                        onClick={() => setDeleteTarget(customer)}
                        className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-semibold text-red-400 hover:bg-red-400/10 hover:text-red-500 transition-colors"
                      >
                        <Trash weight="bold" className="w-3.5 h-3.5" />
                        Delete
                      </button>
                    </>
                  )}
                </div>
              </div>
            )
          })
        )}
      </div>

      <CustomerModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        initialData={selectedCustomer}
        onSaved={fetchCustomers}
      />

      <ConfirmDeleteDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Delete this customer?"
        description="This customer will no longer appear in order and pattern pickers."
        itemName={deleteTarget?.label}
      />
    </div>
  )
}
