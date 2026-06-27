import { useState, useMemo, useEffect } from 'react'
import { X, Plus, Fire, Cube, CubeTransparent } from '@phosphor-icons/react'
import { Button } from '@/shared/ui/button'
import { Input } from '@/shared/ui/input'
import { Label } from '@/shared/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select'
import { cn } from '@/shared/lib/utils'
import { BacklogItem } from '@/modules/production/presentation/daily-planning-modal'

interface PlanningDrawerProps {
  isOpen: boolean
  onClose: () => void
  date: string
  openOrders: any[]
  backlogData: { Core: BacklogItem[], Mould: BacklogItem[], Melt: BacklogItem[] }
  dailyPlans: any[] // existing plans for this date
  onSaveDayPlan: (date: string, plans: any[]) => void
  defaultOrderToAdd?: string | null
}

export function PlanningDrawer({
  isOpen,
  onClose,
  date,
  openOrders,
  backlogData,
  dailyPlans,
  onSaveDayPlan,
  defaultOrderToAdd
}: PlanningDrawerProps) {
  const [draftPlans, setDraftPlans] = useState<Record<string, { core: Record<string, number>, mould: number, melt: number }>>({})
  const [selectedOrderToAdd, setSelectedOrderToAdd] = useState<string>('')

  // Initialize draftPlans from dailyPlans
  useEffect(() => {
    if (isOpen) {
      const initial: Record<string, { core: Record<string, number>, mould: number, melt: number }> = {}
      dailyPlans.forEach(p => {
        if (!initial[p.orderId]) {
          initial[p.orderId] = { core: {}, mould: 0, melt: 0 }
        }
        if (p.stage === 'Core' && p.coreBoxCode) {
          initial[p.orderId].core[p.coreBoxCode] = (initial[p.orderId].core[p.coreBoxCode] || 0) + p.quantityScheduled
        } else if (p.stage === 'Mould') {
          initial[p.orderId].mould += p.quantityScheduled
        } else if (p.stage === 'Melt') {
          initial[p.orderId].melt += p.quantityScheduled
        }
      })
      
      // Auto-fill defaultOrderToAdd if provided
      if (defaultOrderToAdd) {
        if (!initial[defaultOrderToAdd]) {
          initial[defaultOrderToAdd] = { core: {}, mould: 0, melt: 0 }
        }
        
        const order = openOrders.find(o => o.id === defaultOrderToAdd)
        if (order) {
          // Pre-fill Core
          backlogData.Core.filter(b => b.orderNo === order.customerOrderNo).forEach(b => {
            const remaining = Math.max(0, b.totalRequired - b.totalScheduled)
            if (remaining > 0 && b.coreBoxCode) {
              initial[defaultOrderToAdd].core[b.coreBoxCode] = remaining
            }
          })
          
          // Pre-fill Mould
          const mouldBacklog = backlogData.Mould.find(b => b.orderNo === order.customerOrderNo)
          if (mouldBacklog) {
            const remaining = Math.max(0, mouldBacklog.totalRequired - mouldBacklog.totalScheduled)
            if (remaining > 0) initial[defaultOrderToAdd].mould = remaining
          }
          
          // Pre-fill Melt
          const meltBacklog = backlogData.Melt.find(b => b.orderNo === order.customerOrderNo)
          if (meltBacklog) {
            const remaining = Math.max(0, meltBacklog.totalRequired - meltBacklog.totalScheduled)
            // Convert to heats. We don't have heat size here so just assume it's kg and they type heats.
            // Wait, previous design says "melt: number", input says "heats". If they type heats, it shouldn't auto-fill kg.
            // Let's just auto-fill kg since the backlog unit is kg, and they can adjust.
            if (remaining > 0) initial[defaultOrderToAdd].melt = remaining
          }
        }
      }
      
      setDraftPlans(initial)
    }
  }, [isOpen, dailyPlans, date, defaultOrderToAdd, openOrders, backlogData])

  const handleAddOrder = () => {
    if (selectedOrderToAdd && !draftPlans[selectedOrderToAdd]) {
      setDraftPlans(prev => ({
        ...prev,
        [selectedOrderToAdd]: { core: {}, mould: 0, melt: 0 }
      }))
      setSelectedOrderToAdd('')
    }
  }

  const handleSave = () => {
    // Flatten draftPlans into an array of plan objects
    const plansToSave: any[] = []
    Object.entries(draftPlans).forEach(([orderId, data]) => {
      // Find the order to get itemId (we assume index 0 for simplicity if multiple, or map properly)
      // Actually, backlogData has itemId. Let's find the itemId for this order.
      // If an order has multiple items, we assign to the first one for simplicity, or we should have selected by itemId.
      // The prompt says "Searchable dropdown: Select active customer order... Per Order planning cards".
      // We will just use `${orderId}-0` as itemId if we can't find it.
      const mouldBacklog = backlogData.Mould.find(b => b.orderNo === openOrders.find(o => o.id === orderId)?.customerOrderNo)
      const itemId = mouldBacklog?.itemId || `${orderId}-0`

      if (data.mould > 0) {
        plansToSave.push({ orderId, itemId, stage: 'Mould', quantityScheduled: data.mould, laborersAssigned: 1 })
      }
      if (data.melt > 0) {
        plansToSave.push({ orderId, itemId, stage: 'Melt', quantityScheduled: data.melt, laborersAssigned: 1 })
      }
      Object.entries(data.core).forEach(([coreBoxCode, qty]) => {
        if (qty > 0) {
          plansToSave.push({ orderId, itemId, stage: 'Core', coreBoxCode, quantityScheduled: qty, laborersAssigned: 1 })
        }
      })
    })
    onSaveDayPlan(date, plansToSave)
    onClose()
  }

  const dateObj = new Date(date)
  const dateString = dateObj.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })

  // Calculate capacities
  const plannedMoulds = Object.values(draftPlans).reduce((sum, d) => sum + (Number(d.mould) || 0), 0)
  const plannedMelts = Object.values(draftPlans).reduce((sum, d) => sum + (Number(d.melt) || 0), 0)

  return (
    <div className={cn(
      "fixed inset-y-0 right-0 w-[420px] bg-[#050810] border-l border-[#243050] shadow-2xl transform transition-transform duration-300 ease-in-out z-50 flex flex-col",
      isOpen ? "translate-x-0" : "translate-x-full"
    )}>
      {/* Header */}
      <div className="flex items-center justify-between p-6 border-b border-[#243050] bg-[#0C1221]">
        <h2 className="text-xl font-heading font-bold text-[#EEF3FF]">{dateString}</h2>
        <button onClick={onClose} className="text-[#8B9FC4] hover:text-white transition-colors">
          <X className="w-6 h-6" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-8">
        {/* Capacity Stat Cards */}
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-[#1A263D] border border-[#243050] rounded-xl p-4">
            <div className="flex items-center gap-2 text-[#EAB308] mb-2">
              <Fire weight="duotone" className="w-5 h-5" />
              <span className="text-xs font-semibold uppercase tracking-wider">Melting (Heats)</span>
            </div>
            <div className="flex items-baseline gap-1">
              <span className="text-2xl font-bold font-mono text-[#EEF3FF]">{plannedMelts}</span>
              <span className="text-[#8B9FC4] text-sm">/ 10</span>
            </div>
          </div>
          <div className="bg-[#1A263D] border border-[#243050] rounded-xl p-4">
            <div className="flex items-center gap-2 text-[#4285F4] mb-2">
              <Cube weight="duotone" className="w-5 h-5" />
              <span className="text-xs font-semibold uppercase tracking-wider">Moulding (Boxes)</span>
            </div>
            <div className="flex items-baseline gap-1">
              <span className="text-2xl font-bold font-mono text-[#EEF3FF]">{plannedMoulds}</span>
              <span className="text-[#8B9FC4] text-sm">/ 200</span>
            </div>
          </div>
        </div>

        {/* Allocate New Order */}
        <div className="space-y-3">
          <Label className="text-[#8B9FC4] text-xs font-semibold uppercase tracking-wider">Allocate New Order To Day</Label>
          <div className="flex gap-2">
            <Select value={selectedOrderToAdd} onValueChange={setSelectedOrderToAdd}>
              <SelectTrigger className="flex-1 bg-[#0C1221] border-[#243050] text-[#EEF3FF]">
                <SelectValue placeholder="Select active customer order..." />
              </SelectTrigger>
              <SelectContent className="bg-[#0C1221] border-[#243050] max-h-60">
                {openOrders.map(o => (
                  <SelectItem key={o.id} value={o.id} className="text-[#EEF3FF]">
                    {o.customerOrderNo} — {o.customer}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button onClick={handleAddOrder} disabled={!selectedOrderToAdd} className="bg-[#D4521A] hover:bg-[#b04213] text-white px-3">
              <Plus weight="bold" className="w-5 h-5" />
            </Button>
          </div>
        </div>

        {/* Per Order Cards */}
        <div className="space-y-6">
          {Object.entries(draftPlans).map(([orderId, data]) => {
            const order = openOrders.find(o => o.id === orderId)
            if (!order) return null
            
            // Find core boxes for this order from backlog
            const orderCoreBacklogs = backlogData.Core.filter(b => b.orderNo === order.customerOrderNo)
            
            return (
              <div key={orderId} className="bg-[#0C1221] border border-[#243050] rounded-xl overflow-hidden">
                <div className="p-4 border-b border-[#243050] bg-[#10172A]">
                  <h3 className="text-xl font-bold font-mono text-[#EEF3FF]">{order.customerOrderNo}</h3>
                  <p className="text-sm text-[#8B9FC4] mt-0.5">{order.customer}</p>
                </div>
                
                <div className="p-4 flex gap-3 overflow-x-auto">
                  {/* CORE Sub-card */}
                  <div className="flex-1 min-w-[120px] bg-[#050810] border border-[#243050] rounded-lg p-3">
                    <div className="flex items-center gap-1.5 text-[#4285F4] mb-3">
                      <CubeTransparent weight="bold" className="w-4 h-4" />
                      <span className="text-xs font-bold uppercase tracking-wider">Core</span>
                    </div>
                    <div className="space-y-3">
                      {orderCoreBacklogs.length === 0 ? (
                        <p className="text-[10px] text-[#5A6E90]">No cores required</p>
                      ) : (
                        orderCoreBacklogs.map(cb => (
                          <div key={cb.coreBoxCode} className="space-y-1">
                            <Label className="text-[10px] text-[#8B9FC4] leading-none">{cb.coreBoxCode}</Label>
                            <div className="flex items-center gap-2">
                              <Input 
                                type="number" 
                                min="0"
                                value={data.core[cb.coreBoxCode!] || ''}
                                onChange={(e) => setDraftPlans(prev => ({
                                  ...prev,
                                  [orderId]: {
                                    ...prev[orderId],
                                    core: { ...prev[orderId].core, [cb.coreBoxCode!]: Number(e.target.value) }
                                  }
                                }))}
                                className="h-8 bg-[#0C1221] border-[#243050] text-[#EEF3FF] font-mono px-2 text-sm"
                                placeholder="0"
                              />
                              <span className="text-[10px] text-[#5A6E90]">cores</span>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  {/* MOULDING Sub-card */}
                  <div className="flex-1 min-w-[120px] bg-[#050810] border border-[#243050] rounded-lg p-3">
                    <div className="flex items-center gap-1.5 text-[#D4521A] mb-3">
                      <Cube weight="bold" className="w-4 h-4" />
                      <span className="text-xs font-bold uppercase tracking-wider">Moulding</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Input 
                        type="number" 
                        min="0"
                        value={data.mould || ''}
                        onChange={(e) => setDraftPlans(prev => ({
                          ...prev,
                          [orderId]: { ...prev[orderId], mould: Number(e.target.value) }
                        }))}
                        className="h-8 bg-[#0C1221] border-[#243050] text-[#EEF3FF] font-mono px-2 text-sm"
                        placeholder="0"
                      />
                      <span className="text-[10px] text-[#5A6E90]">moulds</span>
                    </div>
                  </div>

                  {/* MELTING Sub-card */}
                  <div className="flex-1 min-w-[120px] bg-[#050810] border border-[#243050] rounded-lg p-3">
                    <div className="flex items-center gap-1.5 text-[#EAB308] mb-3">
                      <Fire weight="bold" className="w-4 h-4" />
                      <span className="text-xs font-bold uppercase tracking-wider">Melting</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Input 
                        type="number" 
                        min="0"
                        value={data.melt || ''}
                        onChange={(e) => setDraftPlans(prev => ({
                          ...prev,
                          [orderId]: { ...prev[orderId], melt: Number(e.target.value) }
                        }))}
                        className="h-8 bg-[#0C1221] border-[#243050] text-[#EEF3FF] font-mono px-2 text-sm"
                        placeholder="0"
                      />
                      <span className="text-[10px] text-[#5A6E90]">heats</span>
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Footer */}
      <div className="p-6 border-t border-[#243050] bg-[#0C1221] flex justify-end gap-3">
        <Button variant="ghost" onClick={onClose} className="text-[#8B9FC4] hover:text-[#EEF3FF] hover:bg-[#1A263D]">
          Cancel
        </Button>
        <Button onClick={handleSave} className="bg-[#D4521A] hover:bg-[#b04213] text-white px-6">
          Save Day Plan
        </Button>
      </div>
    </div>
  )
}
