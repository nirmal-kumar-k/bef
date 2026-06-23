'use client'

import { useState } from 'react'
import { Plus } from '@phosphor-icons/react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { NewOrderModal } from '@/components/orders/new-order-modal'

// Mock Data
const mockOrders = [
  {
    id: 1,
    customerOrderNo: 'PO-98214',
    internalOrderNo: 'INT-4412',
    customer: 'Alpha Heavy Industries',
    pattern: 'PTRN-101',
    product: 'Housing Assembly A',
    quantity: 1500,
    orderDate: '2026-06-15',
    deliveryDate: '2026-07-20',
    status: 'In Progress',
  },
  {
    id: 2,
    customerOrderNo: 'PO-98215',
    internalOrderNo: 'INT-4413',
    customer: 'Beta Metalworks',
    pattern: 'PTRN-102',
    product: 'Valve Body Core',
    quantity: 800,
    orderDate: '2026-06-20',
    deliveryDate: '2026-08-05',
    status: 'Received',
  },
  {
    id: 3,
    customerOrderNo: 'PO-98210',
    internalOrderNo: 'INT-4401',
    customer: 'Gamma Components',
    pattern: 'PTRN-088',
    product: 'Gear Bracket',
    quantity: 200,
    orderDate: '2026-05-10',
    deliveryDate: '2026-06-01',
    status: 'Completed',
  },
  {
    id: 4,
    customerOrderNo: 'PO-98211',
    internalOrderNo: 'INT-4405',
    customer: 'Alpha Heavy Industries',
    pattern: 'PTRN-101',
    product: 'Housing Assembly B',
    quantity: 500,
    orderDate: '2026-05-15',
    deliveryDate: '2026-06-10',
    status: 'Dispatched',
  },
]

const categories = ['All', 'Received', 'In Progress', 'Completed', 'Dispatched']

const statusColors: Record<string, string> = {
  'Received': 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  'In Progress': 'bg-[#D4521A]/20 text-[#EB6824] border-[#D4521A]/40',
  'Completed': 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  'Dispatched': 'bg-purple-500/20 text-purple-400 border-purple-500/30',
}

const statusAccentColors: Record<string, string> = {
  'Received': 'border-blue-500/30 shadow-[0_0_20px_rgba(59,130,246,0.15)]',
  'In Progress': 'border-[#D4521A]/30 shadow-[0_0_20px_rgba(232,88,26,0.15)]',
  'Completed': 'border-emerald-500/30 shadow-[0_0_20px_rgba(16,185,129,0.15)]',
  'Dispatched': 'border-purple-500/30 shadow-[0_0_20px_rgba(168,85,247,0.15)]',
}

export default function OrdersPage() {
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [activeCategory, setActiveCategory] = useState('All')

  const filteredOrders = mockOrders.filter(
    (order) => activeCategory === 'All' || order.status === activeCategory
  )

  return (
    <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold text-foreground font-heading mb-2">Orders</h1>
            <p className="text-[#8B9FC4]">View and manage production orders</p>
          </div>
          <Button 
            className="bg-[#D4521A] hover:bg-[#EB6824] text-white px-6 py-5 text-sm font-semibold rounded-lg"
            onClick={() => setIsModalOpen(true)}
          >
            <Plus weight="bold" className="mr-2 h-5 w-5" />
            New Order
          </Button>
        </div>

        {/* Filter Bar */}
        <div className="flex items-center gap-3 py-6 px-6 bg-[#0C1221] border border-white/[0.06] rounded-[14px] overflow-x-auto min-h-[80px]">
          {categories.map((cat) => (
            <Badge
              key={cat}
              variant="outline"
              onClick={() => setActiveCategory(cat)}
              className={cn(
                'cursor-pointer h-12 px-8 text-[15px] font-medium transition-colors border rounded-lg min-w-[120px] flex items-center justify-center shrink-0',
                activeCategory === cat
                  ? 'bg-[#D4521A]/20 border-[#D4521A]/40 text-[#EB6824]'
                  : 'bg-transparent text-[#8B9FC4] border-sidebar-border hover:border-[#2E3C5C] hover:text-[#EEF3FF]'
              )}
            >
              {cat}
            </Badge>
          ))}
        </div>

        {/* Orders List View */}
        <div className="space-y-4">
          {filteredOrders.length === 0 ? (
            <div className="py-12 text-center border border-[#243050] rounded-xl bg-[#050810]/50">
              <p className="text-[#8B9FC4] text-lg">No orders found for this status.</p>
            </div>
          ) : (
            filteredOrders.map((order) => (
              <div 
                key={order.id} 
                className={cn(
                  "flex items-center bg-[#0C1221] border p-5 rounded-[14px] hover:bg-white/[0.04] transition-all duration-150",
                  statusAccentColors[order.status]
                )}
              >
                {/* Col 1-2: Stacked Order Numbers */}
                <div className="w-[160px] shrink-0 pr-4 border-r border-[#243050]/50 mr-6">
                  <p className="text-[17px] font-bold text-[#EEF3FF] tracking-tight truncate">{order.customerOrderNo}</p>
                  <p className="text-sm font-mono text-[#5A6E90] mt-1">{order.internalOrderNo}</p>
                </div>

                {/* Middle details tightly aligned to the left */}
                <div className="flex flex-1 items-center gap-6">
                  <div className="w-[200px]">
                    <p className="text-[12px] text-[#8B9FC4] uppercase font-semibold mb-1 tracking-wider">Customer</p>
                    <p className="text-[15px] font-medium text-[#EEF3FF] leading-tight line-clamp-2">{order.customer}</p>
                  </div>

                  <div className="w-[110px]">
                    <p className="text-[12px] text-[#8B9FC4] uppercase font-semibold mb-1 tracking-wider">Pattern</p>
                    <p className="text-[15px] font-mono text-[#C4D2EE] truncate">{order.pattern}</p>
                  </div>

                  <div className="w-[220px]">
                    <p className="text-[12px] text-[#8B9FC4] uppercase font-semibold mb-1 tracking-wider">Product</p>
                    <p className="text-[15px] font-medium text-[#EEF3FF] leading-tight line-clamp-2">{order.product}</p>
                  </div>

                  <div className="w-[90px]">
                    <p className="text-[12px] text-[#8B9FC4] uppercase font-semibold mb-1 tracking-wider">Qty</p>
                    <p className="text-[16px] font-bold text-[#EEF3FF]">{order.quantity.toLocaleString()}</p>
                  </div>

                  <div className="w-[110px]">
                    <p className="text-[12px] text-[#8B9FC4] uppercase font-semibold mb-1 tracking-wider">Order Dt</p>
                    <p className="text-[15px] font-mono text-[#C4D2EE]">{order.orderDate}</p>
                  </div>

                  <div className="w-[110px]">
                    <p className="text-[12px] text-[#8B9FC4] uppercase font-semibold mb-1 tracking-wider">Deliv Dt</p>
                    <p className="text-[15px] font-mono text-[#C4D2EE]">{order.deliveryDate}</p>
                  </div>
                </div>

                {/* Status at the far right */}
                <div className="w-[140px] shrink-0 flex justify-end pl-4">
                  <Badge variant="outline" className={cn("px-4 py-1.5 text-[11px] font-semibold uppercase tracking-wider rounded-md border", statusColors[order.status])}>
                    {order.status}
                  </Badge>
                </div>
              </div>
            ))
          )}
        </div>

        <NewOrderModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
        />
      </div>
  )
}
