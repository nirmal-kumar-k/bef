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
import { BacklogItem } from './daily-planning-modal'
import { Cube, CubeTransparent, Fire } from '@phosphor-icons/react'
import { cn } from '@/shared/lib/utils'

interface PlanningPopupCardProps {
  isOpen: boolean
  onClose: () => void
  date: string
  stage: 'Core' | 'Mould' | 'Melt'
  openOrders: any[]
  backlogData: BacklogItem[]
  dailyPlans: any[] // existing plans for this date and stage
  onSaveDayPlan: (date: string, plans: any[]) => void
}

export function PlanningPopupCard({
  isOpen,
  onClose,
  date,
  stage,
  openOrders,
  backlogData,
  dailyPlans,
  onSaveDayPlan
}: PlanningPopupCardProps) {
  const [selectedOrder, setSelectedOrder] = useState<string>('')
  
  // State for the quantities being scheduled for the currently selected order
  // If Core: { [coreBoxCode]: quantity }
  // If Mould/Melt: { total: quantity }
  const [quantities, setQuantities] = useState<Record<string, number>>({})

  // Initialize form when order changes
  useEffect(() => {
    if (!selectedOrder) {
      setQuantities({})
      return
    }

    const order = openOrders.find(o => o.id === selectedOrder)
    if (!order) return

    const initial: Record<string, number> = {}
    const existingPlans = dailyPlans.filter(p => p.orderId === selectedOrder)

    if (stage === 'Core') {
      const orderCoreBacklog = backlogData.filter(b => b.orderNo === order.customerOrderNo)
      orderCoreBacklog.forEach(b => {
        if (b.coreBoxCode) {
          const existing = existingPlans.find(p => p.coreBoxCode === b.coreBoxCode)?.quantityScheduled || 0
          initial[b.coreBoxCode] = existing
        }
      })
    } else {
      const existing = existingPlans.reduce((sum, p) => sum + p.quantityScheduled, 0)
      initial['total'] = existing
    }

    setQuantities(initial)
  }, [selectedOrder, openOrders, backlogData, dailyPlans, stage])

  // Reset selected order on open
  useEffect(() => {
    if (isOpen) setSelectedOrder('')
  }, [isOpen])

  const handleSave = () => {
    if (!selectedOrder) return

    const order = openOrders.find(o => o.id === selectedOrder)
    if (!order) return

    const plansToSave: any[] = []

    if (stage === 'Core') {
      const orderCoreBacklog = backlogData.filter(b => b.orderNo === order.customerOrderNo)
      Object.entries(quantities).forEach(([code, qty]) => {
        if (qty > 0) {
          const backlog = orderCoreBacklog.find(b => b.coreBoxCode === code)
          plansToSave.push({
            orderId: selectedOrder,
            itemId: backlog?.itemId || `${selectedOrder}-0`,
            stage: 'Core',
            coreBoxCode: code,
            quantityScheduled: qty,
            laborersAssigned: 1
          })
        }
      })
    } else {
      const qty = quantities['total'] || 0
      if (qty > 0) {
        const backlog = backlogData.find(b => b.orderNo === order.customerOrderNo)
        plansToSave.push({
          orderId: selectedOrder,
          itemId: backlog?.itemId || `${selectedOrder}-0`,
          stage,
          quantityScheduled: qty,
          laborersAssigned: 1
        })
      }
    }

    onSaveDayPlan(date, plansToSave)
    onClose()
  }

  const dateObj = new Date(date || new Date())
  const dateString = dateObj.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })

  // Find remaining required for context
  const getRemainingContext = () => {
    if (!selectedOrder) return null
    const order = openOrders.find(o => o.id === selectedOrder)
    if (!order) return null

    if (stage === 'Core') {
      const coreBacklogs = backlogData.filter(b => b.orderNo === order.customerOrderNo)
      if (coreBacklogs.length === 0) return <p className="text-sm text-[#5A6E90]">No core boxes found for this order.</p>

      return (
        <div className="space-y-4 mt-6">
          <Label className="text-xs text-[#8B9FC4] font-semibold uppercase tracking-wider">Assign Core Quantities</Label>
          <div className="space-y-3">
            {coreBacklogs.map(cb => {
              const remaining = Math.max(0, cb.totalRequired - cb.totalScheduled)
              return (
                <div key={cb.coreBoxCode} className="flex items-center justify-between bg-[#1A263D] p-3 rounded-lg border border-[#243050]">
                  <div>
                    <h4 className="text-[#EEF3FF] font-mono font-bold text-sm">{cb.coreBoxCode}</h4>
                    <p className="text-[10px] text-[#8B9FC4]">Remaining: {remaining}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      min="0"
                      value={quantities[cb.coreBoxCode!] === 0 && !quantities[cb.coreBoxCode!] ? '' : quantities[cb.coreBoxCode!] || ''}
                      onChange={(e) => setQuantities({ ...quantities, [cb.coreBoxCode!]: Number(e.target.value) })}
                      className="w-24 bg-[#0C1221] border-[#243050] text-[#EEF3FF] font-mono h-9"
                      placeholder="0"
                    />
                    <Button 
                      variant="ghost" 
                      size="sm"
                      className="text-[10px] h-7 px-2 text-[#4285F4] hover:bg-[#4285F4]/10"
                      onClick={() => setQuantities({ ...quantities, [cb.coreBoxCode!]: remaining })}
                    >
                      Fill
                    </Button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )
    }

    // Mould or Melt
    const backlog = backlogData.find(b => b.orderNo === order.customerOrderNo)
    const remaining = backlog ? Math.max(0, backlog.totalRequired - backlog.totalScheduled) : 0
    const label = stage === 'Mould' ? 'Moulds (Boxes)' : 'Melting (Heats/kg)'

    return (
      <div className="space-y-4 mt-6">
        <Label className="text-xs text-[#8B9FC4] font-semibold uppercase tracking-wider">Assign {label}</Label>
        <div className="flex items-center justify-between bg-[#1A263D] p-4 rounded-lg border border-[#243050]">
          <div>
            <h4 className="text-[#EEF3FF] font-mono font-bold text-sm">Target Quantity</h4>
            <p className="text-[10px] text-[#8B9FC4]">Remaining: {remaining}</p>
          </div>
          <div className="flex items-center gap-2">
            <Input
              type="number"
              min="0"
              value={quantities['total'] === 0 && !quantities['total'] ? '' : quantities['total'] || ''}
              onChange={(e) => setQuantities({ total: Number(e.target.value) })}
              className="w-32 bg-[#0C1221] border-[#243050] text-[#EEF3FF] font-mono h-10"
              placeholder="0"
            />
            <Button 
              variant="ghost" 
              size="sm"
              className="text-[10px] h-7 px-2 text-[#4285F4] hover:bg-[#4285F4]/10"
              onClick={() => setQuantities({ total: remaining })}
            >
              Fill
            </Button>
          </div>
        </div>
      </div>
    )
  }

  // Styles based on stage
  const stageColors = {
    Core: 'text-[#4285F4] border-[#4285F4]/20 bg-[#4285F4]/10',
    Mould: 'text-[#D4521A] border-[#D4521A]/20 bg-[#D4521A]/10',
    Melt: 'text-[#EAB308] border-[#EAB308]/20 bg-[#EAB308]/10'
  }
  const StageIcon = stage === 'Core' ? CubeTransparent : stage === 'Mould' ? Cube : Fire

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="w-full sm:max-w-md bg-[#050810] border-[#243050] text-foreground">
        <DialogHeader>
          <div className="flex items-center justify-between pr-4">
            <div>
              <DialogTitle className="text-lg font-heading text-white">
                {dateString}
              </DialogTitle>
              <div className="flex items-center gap-2 mt-1">
                <span className={cn("px-2 py-0.5 text-[10px] font-bold uppercase rounded-md border flex items-center gap-1", stageColors[stage])}>
                  <StageIcon weight="bold" className="w-3 h-3" />
                  {stage} Planning
                </span>
              </div>
            </div>
          </div>
        </DialogHeader>

        <div className="py-4">
          <div className="space-y-2">
            <Label className="text-[#8B9FC4] text-xs font-semibold uppercase tracking-wider">Select Order</Label>
            <Select value={selectedOrder} onValueChange={setSelectedOrder}>
              <SelectTrigger className="bg-[#0C1221] border-[#243050] text-[#EEF3FF]">
                <SelectValue placeholder="Select active customer order..." />
              </SelectTrigger>
              <SelectContent className="bg-[#0C1221] border-[#243050] max-h-60">
                {openOrders.map(o => {
                  const hasBacklog = backlogData.some(b => b.orderNo === o.customerOrderNo && (b.totalRequired - b.totalScheduled) > 0)
                  if (!hasBacklog) return null
                  return (
                    <SelectItem key={o.id} value={o.id} className="text-[#EEF3FF]">
                      <span className="font-mono text-[#4285F4] mr-2">{o.customerOrderNo}</span> {o.customer}
                    </SelectItem>
                  )
                })}
                {openOrders.filter(o => backlogData.some(b => b.orderNo === o.customerOrderNo && (b.totalRequired - b.totalScheduled) > 0)).length === 0 && (
                  <SelectItem value="none" disabled>No pending orders</SelectItem>
                )}
              </SelectContent>
            </Select>
          </div>

          {getRemainingContext()}
        </div>

        <DialogFooter className="border-t border-[#243050] pt-4 mt-2">
          <Button variant="ghost" onClick={onClose} className="text-[#8B9FC4] hover:text-[#EEF3FF] hover:bg-[#1A263D]">
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={!selectedOrder} className="bg-[#D4521A] hover:bg-[#b04213] text-white">
            Save Day Plan
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
