'use client'

import { useState, useEffect, useCallback } from 'react'
import { Plus } from '@phosphor-icons/react'
import { Button } from '@/shared/ui/button'
import { Badge } from '@/shared/ui/badge'
import { cn } from '@/shared/lib/utils'
import { NewOrderModal } from '@/modules/orders/presentation/new-order-modal'
import { ViewOrderModal } from '@/modules/orders/presentation/view-order-modal'
import { categories, statusColors, statusAccentColors, type Order } from '@/modules/orders/domain/order.types'
import { useRole } from '@/shared/context/role-context'

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [viewOrderId, setViewOrderId] = useState<string | null>(null)
  const [editOrderId, setEditOrderId] = useState<string | null>(null)
  const [activeCategory, setActiveCategory] = useState('All')
  const { role } = useRole()

  const fetchOrders = useCallback(async () => {
    try {
      const res = await fetch('/api/orders')
      if (res.ok) {
        const data = await res.json()
        setOrders(data)
      }
    } catch (err) {
      console.error('Failed to fetch orders:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchOrders()
  }, [fetchOrders])

  const handleSaveOrder = async (order: Order | Omit<Order, 'id'>) => {
    try {
      const isEdit = 'id' in order
      const url = isEdit ? `/api/orders/${(order as Order).id}` : '/api/orders'
      const method = isEdit ? 'PUT' : 'POST'
      
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(order),
      })
      if (res.ok) {
        await fetchOrders()
        setIsModalOpen(false)
        setEditOrderId(null)
      }
    } catch (err) {
      console.error('Failed to save order:', err)
    }
  }

  const filteredOrders = orders.filter((order) => {
    // Role-based visibility
    // Status filter
    return activeCategory === 'All' || order.status === activeCategory;
  })

  const viewingOrder = orders.find(o => o.id === viewOrderId) || null
  const editingOrder = orders.find(o => o.id === editOrderId) || null

  return (
    <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold text-foreground font-heading mb-2">Sales Orders</h1>
            <p className="text-[#8B9FC4]">View and manage sales orders</p>
          </div>
          {role !== 'Supervisor' && (
            <Button 
              className="bg-[#D4521A] hover:bg-[#D4521A] text-white px-6 py-5 text-sm font-semibold rounded-lg"
              onClick={() => setIsModalOpen(true)}
            >
              <Plus weight="bold" className="mr-2 h-5 w-5" />
              New Sales Order
            </Button>
          )}
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
                  ? 'bg-[#D4521A]/20 border-[#D4521A]/40 text-[#D4521A]'
                  : 'bg-transparent text-[#8B9FC4] border-sidebar-border hover:border-[#2E3C5C] hover:text-[#EEF3FF]'
              )}
            >
              {cat}
            </Badge>
          ))}
        </div>

        {/* Orders List View */}
        <div className="space-y-4">
          {loading ? (
            <div className="py-20 text-center">
              <p className="text-[#8B9FC4] text-lg animate-pulse">Loading orders...</p>
            </div>
          ) : orders.length === 0 ? (
            <div className="py-20 text-center border border-dashed border-[#243050] rounded-xl bg-[#0C1221]/30">
              <p className="text-[#8B9FC4] text-lg font-medium">No orders yet</p>
              <p className="text-[#5A6E90] text-sm mt-1">Click &quot;New Order&quot; to create your first order</p>
            </div>
          ) : filteredOrders.length === 0 ? (
            <div className="py-12 text-center border border-[#243050] rounded-xl bg-[#050810]/50">
              <p className="text-[#8B9FC4] text-lg">No orders found for this status.</p>
            </div>
          ) : (
            filteredOrders.map((order) => (
              <div 
                key={order.id} 
                onClick={() => {
                  if (role === 'Admin') {
                    setEditOrderId(order.id)
                  } else {
                    setViewOrderId(order.id)
                  }
                }}
                className={cn(
                  "flex items-center bg-[#0C1221] border p-5 rounded-[14px] hover:bg-white/[0.04] transition-all duration-150 cursor-pointer",
                  statusAccentColors[order.status] || 'border-white/[0.06]'
                )}
              >
                <div className="w-[160px] shrink-0 pr-4 border-r border-[#243050]/50 mr-6">
                  <p className="text-[17px] font-bold text-[#EEF3FF] tracking-tight truncate">{order.customerOrderNo}</p>
                  <p className="text-sm font-mono text-[#5A6E90] mt-1">{order.internalOrderNo}</p>
                </div>

                <div className="flex flex-1 items-center gap-6">
                  <div className="w-[200px]">
                    <p className="text-[12px] text-[#8B9FC4] uppercase font-semibold mb-1 tracking-wider">Customer</p>
                    <p className="text-[15px] font-medium text-[#EEF3FF] leading-tight line-clamp-2">{order.customer}</p>
                  </div>
                  <div className="w-[330px]">
                    <p className="text-[12px] text-[#8B9FC4] uppercase font-semibold mb-1 tracking-wider">Product</p>
                    <p className="text-[15px] font-medium text-[#EEF3FF] leading-tight line-clamp-2">
                      {order.cart && order.cart.length > 0 
                        ? (order.cart.length === 1 ? order.cart[0].productName : `${order.cart.length} Products`)
                        : (order as any).product || 'N/A'}
                    </p>
                  </div>
                  <div className="w-[90px]">
                    <p className="text-[12px] text-[#8B9FC4] uppercase font-semibold mb-1 tracking-wider">Qty</p>
                    <p className="text-[16px] font-bold text-[#EEF3FF]">
                      {order.cart && order.cart.length > 0
                        ? order.cart.reduce((sum, item) => sum + item.quantity, 0).toLocaleString()
                        : ((order as any).quantity || 0).toLocaleString()}
                    </p>
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

                <div className="ml-auto pl-4">
                  <Badge variant="outline" className={cn('text-[13px] px-3 py-1', statusColors[order.status])}>
                    {order.status.toUpperCase()}
                  </Badge>
                </div>
              </div>
            ))
          )}
        </div>

        <NewOrderModal 
          isOpen={isModalOpen || !!editOrderId} 
          onClose={() => {
            setIsModalOpen(false)
            setEditOrderId(null)
          }} 
          onSave={handleSaveOrder}
          initialData={editingOrder}
        />
        <ViewOrderModal order={viewingOrder} onClose={() => setViewOrderId(null)} />
    </div>
  )
}
