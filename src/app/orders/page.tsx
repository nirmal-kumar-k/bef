'use client'

import { useState, useEffect, useCallback } from 'react'
import { Plus, PencilSimple, Trash } from '@phosphor-icons/react'
import { Button } from '@/shared/ui/button'
import { Badge } from '@/shared/ui/badge'
import { cn } from '@/shared/lib/utils'
import { NewOrderModal } from '@/modules/orders/presentation/new-order-modal'
import { ViewOrderModal } from '@/modules/orders/presentation/view-order-modal'
import { ConfirmDeleteDialog } from '@/shared/ui/confirm-delete-dialog'
import { categories, statusColors, statusAccentColors, type Order } from '@/modules/orders/domain/order.types'
import { useRole } from '@/shared/context/role-context'

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [viewOrderId, setViewOrderId] = useState<string | null>(null)
  const [editOrderId, setEditOrderId] = useState<string | null>(null)
  const [orderToDelete, setOrderToDelete] = useState<Order | null>(null)
  const [activeCategory, setActiveCategory] = useState('All')
  const { role } = useRole()

  const handleDeleteOrder = async (id: string, force = false) => {
    try {
      const res = await fetch(`/api/orders/${id}${force ? '?force=true' : ''}`, { method: 'DELETE' })
      if (res.ok) {
        await fetchOrders()
        setViewOrderId(null)
        return
      }

      const data = await res.json().catch(() => ({}))
      if (res.status === 409 && data.hasProductionPlans) {
        const plural = data.planCount === 1 ? 'plan' : 'plans'
        const confirmed = confirm(
          `This order has ${data.planCount} active production ${plural} (Core/Mould/Melt/Knockout). Deleting it will also delete those plans. Delete anyway?`
        )
        if (confirmed) await handleDeleteOrder(id, true)
        return
      }

      alert(data.error || 'Failed to delete order.')
    } catch (err) {
      console.error('Failed to delete order:', err)
      alert('Failed to delete order.')
    }
  }

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
    <div className="space-y-6 animate-in fade-in duration-300 ease-out">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold text-foreground font-heading mb-2">Sales Orders</h1>
            <p className="text-[#64748B]">View and manage sales orders</p>
          </div>
          {role !== 'Supervisor' && (
            <Button 
              className="bg-[#4F46E5] hover:bg-[#4F46E5] text-white px-6 py-5 text-sm font-semibold rounded-lg"
              onClick={() => setIsModalOpen(true)}
            >
              <Plus weight="bold" className="mr-2 h-5 w-5" />
              New Sales Order
            </Button>
          )}
        </div>

        {/* Filter Bar */}
        <div className="flex items-center gap-3 py-6 px-6 bg-[#FFFFFF] border border-black/[0.04] rounded-[14px] overflow-x-auto min-h-[80px]">
          {categories.map((cat) => (
            <Badge
              key={cat}
              variant="outline"
              onClick={() => setActiveCategory(cat)}
              className={cn(
                'cursor-pointer h-12 px-8 text-[15px] font-medium transition-colors border rounded-lg min-w-[120px] flex items-center justify-center shrink-0',
                activeCategory === cat
                  ? 'bg-[#4F46E5]/20 border-[#4F46E5]/40 text-[#4F46E5]'
                  : 'bg-transparent text-[#64748B] border-sidebar-border hover:border-[#C7D2FE] hover:text-[#172554]'
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
              <p className="text-[#64748B] text-lg animate-pulse">Loading orders...</p>
            </div>
          ) : orders.length === 0 ? (
            <div className="py-20 text-center border border-dashed border-[#E0E7FF] rounded-xl bg-[#FFFFFF]/30">
              <p className="text-[#64748B] text-lg font-medium">No orders yet</p>
              <p className="text-[#94A3B8] text-sm mt-1">Click &quot;New Order&quot; to create your first order</p>
            </div>
          ) : filteredOrders.length === 0 ? (
            <div className="py-12 text-center border border-[#E0E7FF] rounded-xl bg-[#F4F6FB]/50">
              <p className="text-[#64748B] text-lg">No orders found for this status.</p>
            </div>
          ) : (
            filteredOrders.map((order) => (
              <div 
                key={order.id} 
                onClick={() => setViewOrderId(order.id)}
                className={cn(
                  "flex items-center bg-[#FFFFFF] border p-5 rounded-[14px] hover:bg-black/[0.03] transition-all duration-150 cursor-pointer group",
                  statusAccentColors[order.status] || 'border-black/[0.04]'
                )}
              >
                <div className="w-[160px] shrink-0 pr-4 border-r border-[#E0E7FF]/50 mr-6">
                  <p className="text-[17px] font-bold text-[#172554] tracking-tight truncate">{order.customerOrderNo}</p>
                  <p className="text-sm font-mono text-[#94A3B8] mt-1">{order.internalOrderNo}</p>
                </div>

                <div className="flex flex-1 items-center gap-6">
                  <div className="w-[200px]">
                    <p className="text-[12px] text-[#64748B] uppercase font-semibold mb-1 tracking-wider">Customer</p>
                    <p className="text-[15px] font-medium text-[#172554] leading-tight line-clamp-2">{order.customer}</p>
                  </div>
                  <div className="w-[330px]">
                    <p className="text-[12px] text-[#64748B] uppercase font-semibold mb-1 tracking-wider">Product</p>
                    <p className="text-[15px] font-medium text-[#172554] leading-tight line-clamp-2">
                      {order.cart && order.cart.length > 0 
                        ? (order.cart.length === 1 ? order.cart[0].productName : `${order.cart.length} Products`)
                        : (order as any).product || 'N/A'}
                    </p>
                  </div>
                  <div className="w-[90px]">
                    <p className="text-[12px] text-[#64748B] uppercase font-semibold mb-1 tracking-wider">Qty</p>
                    <p className="text-[16px] font-bold text-[#172554]">
                      {order.cart && order.cart.length > 0
                        ? order.cart.reduce((sum, item) => sum + item.quantity, 0).toLocaleString()
                        : ((order as any).quantity || 0).toLocaleString()}
                    </p>
                  </div>
                  <div className="w-[110px]">
                    <p className="text-[12px] text-[#64748B] uppercase font-semibold mb-1 tracking-wider">Order Dt</p>
                    <p className="text-[15px] font-mono text-[#0F172A]">{order.orderDate}</p>
                  </div>
                  <div className="w-[110px]">
                    <p className="text-[12px] text-[#64748B] uppercase font-semibold mb-1 tracking-wider">Deliv Dt</p>
                    <p className="text-[15px] font-mono text-[#0F172A]">{order.deliveryDate}</p>
                  </div>
                </div>

                <div className="ml-auto pl-4 flex items-center gap-3">
                  <Badge variant="outline" className={cn('text-[13px] px-3 py-1', statusColors[order.status])}>
                    {order.status.toUpperCase()}
                  </Badge>
                  {role === 'Admin' && (
                    <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={(e) => {
                          e.stopPropagation()
                          setEditOrderId(order.id)
                        }}
                        className="h-8 w-8 text-[#64748B] hover:text-[#4F46E5] hover:bg-[#EEF2FF]"
                      >
                        <PencilSimple className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={(e) => {
                          e.stopPropagation()
                          setOrderToDelete(order)
                        }}
                        className="h-8 w-8 text-[#64748B] hover:text-red-500 hover:bg-red-50"
                      >
                        <Trash className="w-4 h-4" />
                      </Button>
                    </div>
                  )}
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
          existingOrders={orders}
        />
        <ViewOrderModal 
          order={viewingOrder} 
          onClose={() => setViewOrderId(null)} 
          onEdit={viewingOrder ? () => {
            setViewOrderId(null)
            setEditOrderId(viewingOrder.id)
          } : undefined}
          onDelete={viewingOrder ? () => setOrderToDelete(viewingOrder) : undefined}
        />
        <ConfirmDeleteDialog
          open={!!orderToDelete}
          onOpenChange={(open) => !open && setOrderToDelete(null)}
          onConfirm={() => orderToDelete && handleDeleteOrder(orderToDelete.id)}
          title="Delete Sales Order"
          description="Are you sure you want to delete this sales order? All mapped scheduling backlog and production items for this order may be affected."
          itemName={orderToDelete?.customerOrderNo}
        />
    </div>
  )
}
