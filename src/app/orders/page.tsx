'use client'

import { useState, useEffect, useCallback } from 'react'
import { Plus, PencilSimple, Trash } from '@phosphor-icons/react'
import { Button } from '@/shared/ui/button'
import { Badge } from '@/shared/ui/badge'
import { cn } from '@/shared/lib/utils'
import { NewOrderModal } from '@/modules/orders/presentation/new-order-modal'
import { ViewOrderModal } from '@/modules/orders/presentation/view-order-modal'
import { ConfirmDeleteDialog } from '@/shared/ui/confirm-delete-dialog'
import { ConfirmDialog, type ConfirmDialogState } from '@/shared/ui/confirm-dialog'
import { ConflictDialog, formatWhen, type ConflictItem } from '@/shared/ui/conflict-dialog'
import { categories, statusColors, statusAccentColors, type Order } from '@/modules/orders/domain/order.types'
import { useRole } from '@/shared/context/role-context'

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [viewOrderId, setViewOrderId] = useState<string | null>(null)
  const [editOrderId, setEditOrderId] = useState<string | null>(null)
  const [orderToDelete, setOrderToDelete] = useState<Order | null>(null)
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogState | null>(null)
  // An edit refused because someone else saved the order first, with what
  // this user tried to save so they can choose to overwrite.
  const [orderConflict, setOrderConflict] = useState<{ item: ConflictItem; order: Order } | null>(null)
  const [resolvingConflict, setResolvingConflict] = useState(false)
  const [activeCategory, setActiveCategory] = useState('All')
  const { role } = useRole()

  const handleDeleteOrder = async (id: string, force = false) => {
    try {
      const version = orders.find(o => o.id === id)?.version
      const query = [force ? 'force=true' : '', version ? `version=${version}` : ''].filter(Boolean).join('&')
      const res = await fetch(`/api/orders/${id}${query ? `?${query}` : ''}`, { method: 'DELETE' })
      if (res.ok) {
        await fetchOrders()
        setViewOrderId(null)
        return
      }

      const data = await res.json().catch(() => ({}))
      if (res.status === 409 && data.hasProductionPlans) {
        const plural = data.planCount === 1 ? 'plan' : 'plans'
        setConfirmDialog({
          title: 'Delete order and its production plans?',
          description: `This order has ${data.planCount} active production ${plural} (Core/Mould/Melt/Knockout). Deleting it will also delete those plans.`,
          confirmLabel: 'Delete Anyway',
          cancelLabel: 'Cancel',
          onConfirm: () => { handleDeleteOrder(id, true) },
        })
        return
      }

      // A 409 with conflict details: someone edited the order since the list
      // loaded - refresh so what's shown is what would be deleted.
      if (res.status === 409 && data.conflict) await fetchOrders()
      setConfirmDialog({
        title: 'Could Not Delete Order',
        description: data.error || 'Failed to delete order.',
        onConfirm: () => {},
      })
    } catch (err) {
      console.error('Failed to delete order:', err)
      setConfirmDialog({
        title: 'Could Not Delete Order',
        description: 'Failed to delete order.',
        onConfirm: () => {},
      })
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

  const handleSaveOrder = async (order: Order | Omit<Order, 'id'>, overwriteVersion?: number): Promise<boolean> => {
    try {
      // New orders now also carry a client-generated id (so the create
      // request can be idempotent) - "has an id" alone no longer means
      // "this is an edit". An edit's id already exists in the loaded orders
      // list; a freshly-generated one for a new order never will.
      const isEdit = 'id' in order && orders.some(o => o.id === (order as Order).id)
      const url = isEdit ? `/api/orders/${(order as Order).id}` : '/api/orders'
      const method = isEdit ? 'PUT' : 'POST'
      
      // An edit sends the version it was opened at, so a save over someone
      // else's newer change is refused instead of silently replacing it.
      const version = isEdit ? (overwriteVersion ?? orders.find(o => o.id === (order as Order).id)?.version) : undefined
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(version ? { ...order, version } : order),
      })
      if (res.ok) {
        await fetchOrders()
        setIsModalOpen(false)
        setEditOrderId(null)
        return true
      }
      const data = await res.json().catch(() => ({}))
      if (res.status === 409 && data.conflict) {
        setOrderConflict({
          item: { label: `Order ${(order as Order).customerOrderNo || ''}`.trim(), conflict: data.conflict, mine: order as unknown as Record<string, unknown> },
          order: order as Order,
        })
        return false
      }
      // Previously a failed save was ignored and the form just stayed open.
      setConfirmDialog({ title: 'Could Not Save Order', description: data.error || `Failed to save order (HTTP ${res.status}).`, onConfirm: () => {} })
      return false
    } catch (err) {
      console.error('Failed to save order:', err)
      setConfirmDialog({ title: 'Could Not Save Order', description: 'Failed to save order - check the connection and try again.', onConfirm: () => {} })
      return false
    }
  }

  // Conflict dialog: reload shows their version (this user's edit was not
  // stored); overwrite resends this user's order against the current version.
  const handleOrderConflictReload = async () => {
    setOrderConflict(null)
    setIsModalOpen(false)
    setEditOrderId(null)
    await fetchOrders()
  }
  const handleOrderConflictOverwrite = async () => {
    if (!orderConflict) return
    setResolvingConflict(true)
    const { order, item } = orderConflict
    setOrderConflict(null)
    await handleSaveOrder(order, item.conflict.currentVersion)
    setResolvingConflict(false)
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
                  {order.updatedByName && (
                    <p className="text-[11px] text-[#94A3B8] mt-1 truncate" title={`Last edited by ${order.updatedByName}`}>
                      Edited by {order.updatedByName}{order.updatedAt ? ` · ${formatWhen(order.updatedAt)}` : ''}
                    </p>
                  )}
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

        <ConfirmDialog state={confirmDialog} onClose={() => setConfirmDialog(null)} />
        <ConflictDialog items={orderConflict ? [orderConflict.item] : null} onReload={handleOrderConflictReload} onOverwrite={handleOrderConflictOverwrite} busy={resolvingConflict} />
    </div>
  )
}
