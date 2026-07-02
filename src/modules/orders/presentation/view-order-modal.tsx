import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/shared/ui/dialog'
import { cn } from '@/shared/lib/utils'
import { Badge } from '@/shared/ui/badge'
import { Button } from '@/shared/ui/button'
import { Download, FilePdf, Printer } from '@phosphor-icons/react'
import { statusColors, type Order } from '@/modules/orders/domain/order.types'
import { useRole } from '@/shared/context/role-context'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/ui/select'
import { Input } from '@/shared/ui/input'
import { useState } from 'react'

export function ViewOrderModal({
  order,
  onClose,
}: {
  order: Order | null
  onClose: () => void
}) {
  const { role } = useRole()
  const [updating, setUpdating] = useState(false)
  
  if (!order) return null

  const handleStatusChange = async (newStatus: string) => {
    setUpdating(true)
    try {
      await fetch(`/api/orders/${order.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...order, status: newStatus }),
      })
      order.status = newStatus 
    } finally {
      setUpdating(false)
    }
  }

  const handleDeliveryQtyChange = async (itemId: string, newQty: number) => {
    const item = order.cart.find(i => i.id === itemId)
    if (!item) return
    
    item.deliveryQuantity = newQty
    
    // Auto-complete order if all items are fully delivered
    const allDelivered = order.cart.every(i => i.deliveryQuantity >= i.quantity)
    const newStatus = allDelivered ? 'Completed' : order.status
    
    setUpdating(true)
    try {
      await fetch(`/api/orders/${order.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...order, status: newStatus }),
      })
      if (newStatus !== order.status) {
        order.status = newStatus
      }
    } finally {
      setUpdating(false)
    }
  }

  const handleItemFieldChange = async (itemId: string, field: 'quantity' | 'unitCost', value: number) => {
    const item = order.cart.find(i => i.id === itemId)
    if (!item) return

    if (field === 'quantity') item.quantity = value
    if (field === 'unitCost') item.unitCost = value

    // Recalculate totals
    let newSubtotal = 0
    order.cart.forEach(i => {
      const cost = i.unitCost ?? (i.weight * i.ratePerKg) ?? 0
      newSubtotal += cost * i.quantity
    })
    order.subtotal = newSubtotal
    order.gstAmount = newSubtotal * (order.gstPercent / 100)
    order.grandTotal = newSubtotal + order.gstAmount

    setUpdating(true)
    try {
      await fetch(`/api/orders/${order.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(order),
      })
    } finally {
      setUpdating(false)
    }
  }

  // Determine allowed statuses
  const availableStatuses = []
  if (order.status === 'Received') {
    availableStatuses.push('Completed')
  } else if (order.status === 'Completed') {
    availableStatuses.push('Received')
  }
  
  const allWorkflowStatuses = ['Received', 'Completed']

  return (
    <Dialog open={!!order} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="w-full sm:max-w-3xl bg-[#F4F6FB] border-[#E0E7FF] text-foreground max-h-[90vh] overflow-y-auto">
        <DialogHeader className="flex flex-row items-start justify-between">
          <div>
            <div className="flex items-center gap-3">
              <DialogTitle className="text-2xl font-bold font-heading text-[#172554]">
                Sales Order {order.customerOrderNo}
              </DialogTitle>
              <Select 
                value={order.status} 
                onValueChange={handleStatusChange}
                disabled={updating || availableStatuses.length === 0}
              >
                <SelectTrigger className={`h-8 border-0 ${statusColors[order.status]} bg-transparent focus:ring-0`}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-[#FFFFFF] border-[#E0E7FF] text-[#172554]">
                  <SelectItem value={order.status}>{order.status}</SelectItem>
                  {availableStatuses.map(s => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <p className="text-sm text-[#64748B] font-mono mt-1">Internal: {order.internalOrderNo}</p>
          </div>
          <div className="flex gap-2 mr-8">
            <Button variant="outline" size="sm" className="bg-[#FFFFFF] border-[#E0E7FF] text-[#64748B] hover:text-[#172554] hover:bg-[#EEF2FF]">
              <Printer weight="duotone" className="mr-2 h-4 w-4" /> Print
            </Button>
            <Button variant="outline" size="sm" className="bg-[#FFFFFF] border-[#E0E7FF] text-[#64748B] hover:text-[#172554] hover:bg-[#EEF2FF]">
              <Download weight="duotone" className="mr-2 h-4 w-4" /> Export
            </Button>
          </div>
        </DialogHeader>

        <div className="py-6 space-y-8">
          
          {/* Top Details */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 bg-[#FFFFFF]/50 p-5 rounded-xl border border-[#E0E7FF]">
            <div>
              <p className="text-[#64748B] text-xs font-semibold uppercase tracking-wider mb-1">Customer</p>
              <p className="text-[15px] font-medium text-[#172554]">{order.customer}</p>
            </div>
            <div>
              <p className="text-[#64748B] text-xs font-semibold uppercase tracking-wider mb-1">Order Date</p>
              <p className="text-[15px] font-mono text-[#172554]">{order.orderDate || '-'}</p>
            </div>
            <div>
              <p className="text-[#64748B] text-xs font-semibold uppercase tracking-wider mb-1">Delivery Date</p>
              <p className="text-[15px] font-mono text-[#172554]">{order.deliveryDate || '-'}</p>
            </div>
            <div>
              <p className="text-[#64748B] text-xs font-semibold uppercase tracking-wider mb-1">Total Quantity</p>
              <p className="text-[16px] font-bold text-[#172554]">{order.quantity.toLocaleString()}</p>
            </div>
          </div>

          {/* Line Items */}
          <div className="space-y-4">
            <h3 className="text-[#64748B] text-xs font-semibold uppercase tracking-wider border-b border-[#E0E7FF] pb-2">Line Items</h3>
            <div className="bg-[#FFFFFF] border border-[#E0E7FF] rounded-xl overflow-hidden">
              <table className="w-full text-sm text-left">
                <thead className="bg-[#F4F6FB] border-b border-[#E0E7FF] text-[#64748B] text-xs uppercase tracking-wider font-semibold">
                  <tr>
                    <th className="px-4 py-3">Product</th>
                    <th className="px-4 py-3 text-right">Ordered Qty</th>
                    <th className="px-4 py-3 text-right">Delivery Qty</th>
                    <th className="px-4 py-3 text-right">Weight</th>
                    {!['Supervisor'].includes(role) && (
                      <th className="px-4 py-3 text-right">Unit Cost</th>
                    )}
                    {role !== 'Supervisor' && (
                      <th className="px-4 py-3 text-right">Line Total</th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E0E7FF]">
                  {order.cart && order.cart.length > 0 ? (
                    order.cart.map((item, idx) => {
                        const safeUnitCost = item.unitCost ?? (item.weight * item.ratePerKg) ?? 0
                        const lineTotal = safeUnitCost * item.quantity
                        return (
                          <tr key={item.id || idx} className="hover:bg-[#EEF2FF]/50 transition-colors">
                            <td className="px-4 py-4">
                              <p className="font-medium text-[#172554]">{item.productName}</p>
                            </td>
                            <td className="px-4 py-4 text-right">
                              {role === 'Admin' ? (
                                <Input 
                                  type="number" 
                                  min="1"
                                  className="h-8 w-20 px-2 ml-auto text-right bg-[#F4F6FB] border-[#E0E7FF] text-[#172554] focus:border-[#4F46E5]" 
                                  defaultValue={item.quantity}
                                  onBlur={(e) => handleItemFieldChange(item.id, 'quantity', Number(e.target.value))}
                                />
                              ) : (
                                <p className="font-medium text-[#172554]">{item.quantity.toLocaleString()}</p>
                              )}
                            </td>
                            <td className="px-4 py-4 text-right">
                              {role === 'Admin' ? (
                                <Input 
                                  type="number" 
                                  min="0"
                                  className="h-8 w-20 px-2 ml-auto text-right bg-[#F4F6FB] border-[#E0E7FF] text-[#172554] focus:border-[#4F46E5]" 
                                  defaultValue={item.deliveryQuantity || 0}
                                  onBlur={(e) => handleDeliveryQtyChange(item.id, Number(e.target.value))}
                                />
                              ) : (
                                <p className="font-medium text-[#172554]">{item.deliveryQuantity || 0}</p>
                              )}
                            </td>
                            <td className="px-4 py-4 text-right text-[#64748B]">{item.weight} kg</td>
                            {!['Supervisor'].includes(role) && (
                              <td className="px-4 py-4 text-right text-[#64748B]">
                                {role === 'Admin' ? (
                                  <div className="flex items-center justify-end gap-1">
                                    <span className="text-[#64748B]">₹</span>
                                    <Input 
                                      type="number" 
                                      min="0"
                                      className="h-8 w-24 px-2 text-right bg-[#F4F6FB] border-[#E0E7FF] text-[#172554] focus:border-[#4F46E5]" 
                                      defaultValue={safeUnitCost}
                                      onBlur={(e) => handleItemFieldChange(item.id, 'unitCost', Number(e.target.value))}
                                    />
                                  </div>
                                ) : (
                                  `₹${safeUnitCost.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}`
                                )}
                              </td>
                            )}
                            {role !== 'Supervisor' && (
                              <td className="px-4 py-4 text-right font-mono font-medium text-[#4F46E5]">
                                ₹{lineTotal.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                              </td>
                            )}
                          </tr>
                        )
                    })
                  ) : (
                    <tr>
                      <td colSpan={6} className="px-4 py-4 text-center text-[#94A3B8]">
                        <p className="font-medium text-[#172554]">No items found in cart.</p>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Totals */}
          {role !== 'Supervisor' && order.subtotal > 0 && (
            <div className="space-y-4">
              <h3 className="text-[#64748B] text-xs font-semibold uppercase tracking-wider border-b border-[#E0E7FF] pb-2">Order Summary</h3>
              <div className="bg-[#FFFFFF]/50 border border-[#E0E7FF] rounded-xl p-5 flex flex-col items-end gap-2">
                <div className="flex justify-between w-[250px]">
                  <p className="text-[#64748B] text-sm">Subtotal</p>
                  <p className="font-mono text-[#172554]">₹{order.subtotal.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</p>
                </div>
                <div className="flex justify-between w-[250px]">
                  <p className="text-[#64748B] text-sm">GST ({order.gstPercent}%)</p>
                  <p className="font-mono text-[#172554]">₹{order.gstAmount.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</p>
                </div>
                <div className={cn("flex justify-between w-[250px]", "border-t border-[#E0E7FF] pt-2 mt-1")}>
                  <p className="text-[#172554] font-semibold uppercase tracking-widest text-sm">Total</p>
                  <p className="text-xl font-bold font-mono text-[#4F46E5]">₹{order.grandTotal.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</p>
                </div>
              </div>
            </div>
          )}

          {/* Documents */}
          <div className="space-y-4">
            <h3 className="text-[#64748B] text-xs font-semibold uppercase tracking-wider border-b border-[#E0E7FF] pb-2">Documents</h3>
            <div className="flex gap-4">
              <div className="flex items-center gap-3 p-3 bg-[#FFFFFF] border border-[#E0E7FF] rounded-lg w-64 hover:bg-[#EEF2FF] transition-colors cursor-pointer">
                <div className="bg-red-500/10 p-2 rounded text-red-400">
                  <FilePdf weight="duotone" className="h-6 w-6" />
                </div>
                <div>
                  <p className="text-sm font-medium text-[#172554]">PO_Document.pdf</p>
                  <p className="text-xs text-[#94A3B8]">1.2 MB</p>
                </div>
              </div>
            </div>
          </div>

        </div>
      </DialogContent>
    </Dialog>
  )
}
