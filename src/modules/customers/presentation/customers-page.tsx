'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent } from '@/shared/ui/card'
import { IngotLoader } from '@/shared/ui/ingot-loader'
import { Buildings, EnvelopeSimple, Phone, MapPin } from '@phosphor-icons/react'

interface Customer {
  id: string
  value: string // Code
  label: string // Name
  email: string
  phone: string
  contactPerson: string
  address: string
  status: string
}

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/customers?detailed=true')
      .then(r => r.json())
      .then(data => {
        setCustomers(data)
        setLoading(false)
      })
      .catch(err => {
        console.error(err)
        setLoading(false)
      })
  }, [])

  if (loading) {
    return <IngotLoader />
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6 animate-in fade-in zoom-in-95 duration-500">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h1 className="text-3xl font-heading font-extrabold text-[#EEF3FF] tracking-tight">Customer Directory</h1>
          <p className="text-[#8B9FC4] text-sm">View all registered customers imported from the database.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {customers.length === 0 ? (
          <div className="col-span-full py-12 text-center text-[#5A6E90]">
            No customers found in the database.
          </div>
        ) : (
          customers.map(customer => (
            <Card key={customer.id} className="bg-[#050810]/50 border-[#243050] hover:border-[#3A4A68] hover:bg-[#070B16] transition-all duration-300">
              <CardContent className="p-5 space-y-4">
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Buildings className="w-5 h-5 text-[#D4521A]" weight="duotone" />
                      <h3 className="font-semibold text-lg text-[#EEF3FF]">{customer.label}</h3>
                    </div>
                    <div className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold tracking-widest uppercase bg-[#1A263D] text-[#8B9FC4]">
                      {customer.value}
                    </div>
                  </div>
                  <div className={`px-2 py-1 rounded-md text-[11px] font-bold tracking-wider uppercase ${customer.status === 'Active' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'}`}>
                    {customer.status || 'Active'}
                  </div>
                </div>

                <div className="pt-4 border-t border-[#243050] space-y-2.5">
                  <div className="flex items-center gap-3 text-[#8B9FC4] text-sm">
                    <div className="w-6 h-6 rounded-md bg-[#0C1221] flex items-center justify-center shrink-0">
                      <EnvelopeSimple className="w-3.5 h-3.5" weight="duotone" />
                    </div>
                    <span className="truncate">{customer.email || 'N/A'}</span>
                  </div>
                  
                  <div className="flex items-center gap-3 text-[#8B9FC4] text-sm">
                    <div className="w-6 h-6 rounded-md bg-[#0C1221] flex items-center justify-center shrink-0">
                      <Phone className="w-3.5 h-3.5" weight="duotone" />
                    </div>
                    <span className="truncate">{customer.phone || 'N/A'}</span>
                  </div>
                  
                  <div className="flex items-start gap-3 text-[#8B9FC4] text-sm">
                    <div className="w-6 h-6 rounded-md bg-[#0C1221] flex items-center justify-center shrink-0 mt-0.5">
                      <MapPin className="w-3.5 h-3.5" weight="duotone" />
                    </div>
                    <span className="line-clamp-2 leading-relaxed">{customer.address || 'N/A'}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  )
}
