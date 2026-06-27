'use client'

import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { Button } from '@/shared/ui/button'
import { cn } from '@/shared/lib/utils'
import { Badge } from '@/shared/ui/badge'
import { Input } from '@/shared/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/ui/select'
import { Label } from '@/shared/ui/label'
import { X, CalendarPlus, ShieldWarning } from '@phosphor-icons/react'

export function ScheduleDrawer({
  isOpen,
  date,
  schedules,
  orders,
  products,
  patterns,
  onClose,
  onRefresh
}: {
  isOpen: boolean
  date: string
  schedules: any[]
  orders: any[]
  products: any[]
  patterns: any[]
  onClose: () => void
  onRefresh: () => Promise<void>
}) {
  const [mounted, setMounted] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  
  // Local state for the schedules on this day
  const [daySchedules, setDaySchedules] = useState<any[]>([])
  
  // For adding a new order to this day
  const [selectedOrder, setSelectedOrder] = useState<string>('')

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (isOpen) {
      // Deep clone schedules for local editing
      setDaySchedules(JSON.parse(JSON.stringify(schedules)))
    }
  }, [isOpen, schedules])

  const validOrders = orders.filter(
    o => o.status === 'Received' || o.status === 'In Progress'
  )

  const handleAddOrder = () => {
    if (!selectedOrder) return
    const order = orders.find(o => (o.id || o._id) === selectedOrder)
    if (!order) return
    
    // Check if already in today's schedule
    if (daySchedules.find(s => s.orderId === selectedOrder)) return

    // Attempt to calculate required quantities based on the order's cart
    let totalMoulds = 0
    let totalCores = 0
    let totalHeats = 0
    
    order.cart?.forEach((item: any) => {
       const product = products.find((p: any) => p.name === item.productName || p.code === item.product)
       const pattern = patterns.find((p: any) => p.mappedProducts?.some((mp: any) => mp.name === product?.name))
       
       const cavities = product?.cavities || 1
       const itemPlannedQty = item.quantity || 0
       const calcMoulds = Math.ceil(itemPlannedQty / cavities)
       
       const mappedProduct = pattern?.mappedProducts?.find((mp: any) => mp.name === product?.name)
       const coreBoxesCount = mappedProduct?.coreBoxesCount || 0
       
       const boxWeight = pattern?.totalWeight || 0
       const furnaceCapacity = 150 
       
       totalMoulds += calcMoulds
       totalCores += (calcMoulds * coreBoxesCount)
       totalHeats += Math.ceil((calcMoulds * boxWeight) / furnaceCapacity)
    })
    
    // For simplicity, default to 0 to let planner decide, or pre-fill with order totals if requested.
    // The prompt says "for example we planned to hit 60 for today", so planner types it.
    // We will just set them to 0 and let the cascade logic do the work when they type the moulds!

    const newSchedule = {
      isNew: true,
      orderId: order.id,
      date,
      shift: 'Morning',
      priority: 'Normal',
      remarks: '',
      status: 'Planned',
      customerOrderNo: order.customerOrderNo,
      customer: order.customer,
      cart: order.cart,
      stages: {
        core: { planned: 0, completed: 0, pending: 0, variance: 0, unit: 'cores' },
        melting: { planned: 0, completed: 0, pending: 0, variance: 0, unit: 'heats' },
        moulding: { planned: 0, completed: 0, pending: 0, variance: 0, unit: 'moulds' },
        pouring: { planned: 0, completed: 0, pending: 0, variance: 0, unit: 'moulds' },
        knockout: { planned: 0, completed: 0, pending: 0, variance: 0, unit: 'pieces' },
        shotBlasting: { planned: 0, completed: 0, pending: 0, variance: 0, unit: 'pieces' },
        grinding: { planned: 0, completed: 0, pending: 0, variance: 0, unit: 'pieces' },
        inspection: { planned: 0, completed: 0, pending: 0, variance: 0, unit: 'pieces' },
        readyForDispatch: { planned: 0, completed: 0, pending: 0, variance: 0, unit: 'pieces' },
      }
    }
    
    setDaySchedules([...daySchedules, newSchedule])
    setSelectedOrder('')
  }

  const updateStagePlanned = (index: number, stageKey: string, value: string) => {
    const val = value === '' ? 0 : parseInt(value, 10)
    if (isNaN(val)) return
    
    const newSchedules = [...daySchedules]
    const s = newSchedules[index]
    s.stages[stageKey].planned = val
    
    // Auto-calculate dependencies when moulding is updated
    if (stageKey === 'moulding') {
       let totalCores = 0
       let totalHeats = 0
       let totalPieces = 0
       
       s.cart?.forEach((item: any) => {
          const product = products.find((p: any) => p.name === item.productName || p.code === item.product)
          const pattern = patterns.find((p: any) => p.mappedProducts?.some((mp: any) => mp.name === product?.name))
          
          const cavities = product?.cavities || 1
          const mappedProduct = pattern?.mappedProducts?.find((mp: any) => mp.name === product?.name)
          const coreBoxesCount = mappedProduct?.coreBoxesCount || 0
          
          const boxWeight = pattern?.totalWeight || 0
          const furnaceCapacity = 150 
          
          // Assuming proportional distribution if mixed cart
          const itemRatio = 1 / (s.cart.length || 1)
          const itemMoulds = Math.ceil(val * itemRatio)
          
          totalCores += (itemMoulds * coreBoxesCount)
          totalPieces += (itemMoulds * cavities)
          totalHeats += Math.ceil((itemMoulds * boxWeight) / furnaceCapacity)
       })
       
       s.stages.core.planned = totalCores
       s.stages.melting.planned = totalHeats
       s.stages.pouring.planned = val
       s.stages.knockout.planned = totalPieces
       s.stages.shotBlasting.planned = totalPieces
       s.stages.grinding.planned = totalPieces
       s.stages.inspection.planned = totalPieces
       s.stages.readyForDispatch.planned = totalPieces
    }
    
    setDaySchedules(newSchedules)
  }

  const handleSave = async () => {
    setIsSaving(true)
    try {
      // Split into new vs existing
      const toCreate = daySchedules.filter(s => s.isNew)
      const toUpdate = daySchedules.filter(s => !s.isNew)
      
      if (toCreate.length > 0) {
        await fetch('/api/schedules', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(toCreate.map(s => {
            const { isNew, customerOrderNo, customer, ...rest } = s
            return rest
          }))
        })
      }
      
      if (toUpdate.length > 0) {
        await fetch('/api/schedules', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(toUpdate.map(s => {
             return { id: s.id, stages: s.stages, status: s.status, remarks: s.remarks }
          }))
        })
      }
      
      await onRefresh()
      onClose()
    } catch (err) {
      console.error('Failed to save day plan', err)
    } finally {
      setIsSaving(false)
    }
  }

  // Calculate totals to show capacity warnings
  const totalMelting = daySchedules.reduce((sum, s) => sum + (s.stages.melting.planned || 0), 0)
  const totalMoulding = daySchedules.reduce((sum, s) => sum + (s.stages.moulding.planned || 0), 0)

  if (!mounted) return null
  
  const displayDate = date ? new Date(date).toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  }) : ''

  const drawerContent = (
    <>
      <div 
        className={cn(
          "fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] transition-opacity duration-300",
          isOpen ? "opacity-100" : "opacity-0 pointer-events-none"
        )} 
        onClick={onClose}
      />
      
      <div className={cn(
        "fixed inset-0 z-[101] flex items-center justify-center p-4 transition-opacity duration-300",
        isOpen ? "opacity-100" : "opacity-0 pointer-events-none"
      )}>
        <div 
          className={cn(
            "bg-[#050810] border border-[#243050] rounded-2xl w-full max-w-[900px] shadow-2xl flex flex-col overflow-hidden max-h-[90vh] transition-transform duration-300 ease-out",
            isOpen ? "scale-100 translate-y-0" : "scale-95 translate-y-4"
          )}
        >
        <div className="flex-1 overflow-y-auto">
          {/* Header */}
          <div className="sticky top-0 z-10 bg-[#0C1221]/95 backdrop-blur-md border-b border-[#243050] px-6 py-5 flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-[#EEF3FF] tracking-tight">Day-Wise Plan</h2>
              <p className="text-[#8B9FC4] text-sm mt-1">{displayDate}</p>
            </div>
            <button onClick={onClose} className="p-2 text-[#5A6E90] hover:text-[#EEF3FF] hover:bg-[#1A263D] rounded-lg transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="p-6 space-y-8">
            {/* Capacity Dashboard */}
            <div className="grid grid-cols-2 gap-4">
               <div className={cn("p-4 rounded-xl border border-[#243050] bg-[#0C1221]", totalMelting > 2000 && "border-red-500/30 bg-red-500/10")}>
                  <div className="flex items-center justify-between mb-2">
                     <span className="text-[#8B9FC4] text-sm font-medium">Melting Capacity (Heats)</span>
                     {totalMelting > 2000 && <ShieldWarning className="text-red-500 w-5 h-5" />}
                  </div>
                  <div className="flex items-end gap-2">
                     <span className={cn("text-2xl font-bold text-[#EEF3FF]", totalMelting > 2000 && "text-red-400")}>{totalMelting}</span>
                     <span className="text-[#5A6E90] text-sm mb-1">/ 2000</span>
                  </div>
               </div>
               <div className={cn("p-4 rounded-xl border border-[#243050] bg-[#0C1221]", totalMoulding > 500 && "border-orange-500/30 bg-orange-500/10")}>
                  <div className="flex items-center justify-between mb-2">
                     <span className="text-[#8B9FC4] text-sm font-medium">Moulding Line Capacity</span>
                     {totalMoulding > 500 && <ShieldWarning className="text-orange-500 w-5 h-5" />}
                  </div>
                  <div className="flex items-end gap-2">
                     <span className={cn("text-2xl font-bold text-[#EEF3FF]", totalMoulding > 500 && "text-orange-400")}>{totalMoulding}</span>
                     <span className="text-[#5A6E90] text-sm mb-1">/ 500</span>
                  </div>
               </div>
            </div>

            {/* Add Order to Day */}
            <div className="bg-[#0C1221] border border-[#243050] rounded-xl p-4 flex gap-3 items-end">
              <div className="flex-1 space-y-2">
                <Label className="text-[#8B9FC4] text-xs uppercase font-bold tracking-wider">Allocate New Order to Day</Label>
                <Select value={selectedOrder} onValueChange={setSelectedOrder}>
                  <SelectTrigger className="bg-[#050810] border-[#243050] text-[#EEF3FF]">
                    <SelectValue placeholder="Select active customer order..." />
                  </SelectTrigger>
                  <SelectContent className="bg-[#0C1221] border-[#243050]">
                    {validOrders.map(o => (
                      <SelectItem key={String(o.id || o._id)} value={String(o.id || o._id)} className="text-[#EEF3FF] hover:bg-[#1A263D] focus:bg-[#1A263D] focus:text-[#EEF3FF] cursor-pointer">
                        {`${o.customerOrderNo} - ${o.customer}`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={handleAddOrder} disabled={!selectedOrder} className="bg-[#D4521A] hover:bg-[#E56020] text-white">
                <CalendarPlus className="w-4 h-4 mr-2" />
                Add to Plan
              </Button>
            </div>

            {/* Scheduled Orders List */}
            <div className="space-y-4">
              {daySchedules.length === 0 ? (
                <div className="text-center py-10 border border-dashed border-[#243050] rounded-xl">
                  <p className="text-[#5A6E90]">No orders scheduled for this day yet.</p>
                </div>
              ) : (
                daySchedules.map((s, idx) => (
                  <div key={idx} className="bg-[#0C1221] border border-[#243050] rounded-xl p-5 space-y-4 relative group">
                     {s.isNew && <Badge className="absolute -top-2 -right-2 bg-blue-500 text-white border-none">New Entry</Badge>}
                         <div className="flex justify-between items-start mb-4">
                            <div>
                               <h4 className="text-lg font-bold text-[#EEF3FF]">{s.customerOrderNo}</h4>
                               <p className="text-[#8B9FC4] text-sm">{s.customer}</p>
                            </div>
                            {s.remarks?.includes('Carried forward') && (
                              <Badge variant="outline" className="bg-red-500/10 text-red-400 border-red-500/20 text-xs">
                                Pending Balance / {s.remarks}
                              </Badge>
                            )}
                         </div>
                     
                     <div className="grid grid-cols-3 gap-4">
                        {['core', 'moulding', 'melting'].map(stageKey => (
                           <div key={stageKey} className="space-y-2 bg-[#050810] p-3 rounded-lg border border-[#243050]">
                              <Label className="text-[#8B9FC4] text-[11px] uppercase font-bold tracking-wider">{stageKey}</Label>
                              <div className="flex items-center gap-2">
                                 <Input 
                                    type="number" 
                                    value={s.stages[stageKey].planned || ''}
                                    onChange={(e) => updateStagePlanned(idx, stageKey, e.target.value)}
                                    className="h-8 w-16 text-sm font-mono font-medium text-center bg-[#EEF3FF]/10 border-transparent text-[#EEF3FF] rounded-md focus:border-[#D4521A] focus:bg-[#0C1221] transition-colors px-1 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" 
                                    placeholder="0"
                                 />
                                 <span className="text-[#5A6E90] text-xs w-10">{s.stages[stageKey].unit}</span>
                              </div>
                           </div>
                        ))}
                     </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-[#243050] bg-[#0C1221] flex justify-end gap-3 shrink-0">
          <Button variant="outline" onClick={onClose} className="border-[#243050] text-[#8B9FC4] hover:text-[#EEF3FF] hover:bg-[#1A263D]">
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isSaving} className="bg-[#EEF3FF] text-[#0C1221] hover:bg-white min-w-[120px]">
            {isSaving ? 'Saving...' : 'Save Day Plan'}
          </Button>
        </div>
        </div>
      </div>
    </>
  )

  return createPortal(drawerContent, document.body)
}
