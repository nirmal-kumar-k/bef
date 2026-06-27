import { useState, useMemo } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/shared/ui/dialog'
import { Button } from '@/shared/ui/button'
import { Input } from '@/shared/ui/input'
import { Label } from '@/shared/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select'
import { Trash } from '@phosphor-icons/react'

export interface BacklogItem {
  itemId: string
  orderNo: string
  patternRef: string
  productName: string
  coreBoxCode?: string // Only for 'Core'
  totalRequired: number
  totalScheduled: number
  unit: string
}

interface DailyPlanningModalProps {
  isOpen: boolean
  onClose: () => void
  date: string
  stage: 'Core' | 'Mould' | 'Melt'
  backlog: BacklogItem[]
  dailyPlans: any[] // Plans already existing on this day
  onSavePlan: (plan: { itemId: string, coreBoxCode?: string, quantity: number, laborers: number }) => void
  onDeletePlan: (planId: string) => void
}

export function DailyPlanningModal({
  isOpen,
  onClose,
  date,
  stage,
  backlog,
  dailyPlans,
  onSavePlan,
  onDeletePlan
}: DailyPlanningModalProps) {
  const [selectedItemId, setSelectedItemId] = useState<string>('')
  const [quantity, setQuantity] = useState<number | ''>('')
  const [laborers, setLaborers] = useState<number | ''>(1)

  const selectedBacklog = useMemo(() => backlog.find(b => {
    // For core, itemId is not enough since one item can have multiple core boxes. 
    // We'll combine itemId and coreBoxCode for the select value if it's Core.
    const uniqueId = stage === 'Core' ? `${b.itemId}::${b.coreBoxCode}` : b.itemId
    return uniqueId === selectedItemId
  }), [backlog, selectedItemId, stage])

  const maxAvailable = selectedBacklog ? Math.max(0, selectedBacklog.totalRequired - selectedBacklog.totalScheduled) : 0

  const handleAdd = () => {
    if (selectedBacklog && quantity && laborers) {
      onSavePlan({
        itemId: selectedBacklog.itemId,
        coreBoxCode: selectedBacklog.coreBoxCode,
        quantity: Number(quantity),
        laborers: Number(laborers)
      })
      setSelectedItemId('')
      setQuantity('')
      setLaborers(1)
    }
  }

  const dateObj = new Date(date)
  const dateString = dateObj.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })

  // Filter backlog to only show items that have remaining requirements
  const availableBacklog = backlog.filter(b => (b.totalRequired - b.totalScheduled) > 0)

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="w-full sm:max-w-2xl bg-[#050810] border-[#243050] text-foreground max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl font-heading text-[#EEF3FF]">
            {stage} Schedule for {dateString}
          </DialogTitle>
        </DialogHeader>

        <div className="py-4 space-y-6">
          {/* List of plans already on this day */}
          <div className="space-y-3">
            <h3 className="text-[#8B9FC4] text-xs font-semibold uppercase tracking-wider">Scheduled Today</h3>
            {dailyPlans.length === 0 ? (
              <p className="text-sm text-[#5A6E90] italic">No {stage.toLowerCase()}s scheduled for this day.</p>
            ) : (
              <div className="space-y-2">
                {dailyPlans.map(plan => {
                  const bItem = backlog.find(b => b.itemId === plan.itemId && b.coreBoxCode === plan.coreBoxCode)
                  return (
                    <div key={plan.id} className="flex items-center justify-between bg-[#0C1221] border border-[#243050] rounded-lg p-3">
                      <div>
                        <p className="text-[#EEF3FF] font-medium text-sm">
                          {bItem?.orderNo} — {bItem?.productName}
                          {plan.coreBoxCode && <span className="text-[#D4521A] ml-2 font-mono">[{plan.coreBoxCode}]</span>}
                        </p>
                        <p className="text-[#8B9FC4] text-xs mt-1">Pattern: {bItem?.patternRef}</p>
                      </div>
                      <div className="flex items-center gap-6">
                        <div className="text-right">
                          <p className="text-[#EEF3FF] font-mono text-lg">{plan.quantityScheduled}</p>
                          <p className="text-[#5A6E90] text-[10px] uppercase">Qty</p>
                        </div>
                        <div className="text-right">
                          <p className="text-[#4285F4] font-mono text-lg">{plan.laborersAssigned}</p>
                          <p className="text-[#5A6E90] text-[10px] uppercase">Laborers</p>
                        </div>
                        <Button variant="ghost" size="icon" onClick={() => onDeletePlan(plan.id)} className="text-red-400 hover:text-red-300 hover:bg-red-400/10">
                          <Trash weight="duotone" className="h-5 w-5" />
                        </Button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          <hr className="border-[#243050]" />

          {/* Add new plan */}
          <div className="bg-[#0C1221] border border-[#243050] rounded-lg p-4 space-y-4">
            <h3 className="text-[#EEF3FF] font-semibold">Assign New Task</h3>
            
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label className="text-[#8B9FC4]">Select Requirement</Label>
                <Select value={selectedItemId} onValueChange={(val) => {
                  setSelectedItemId(val)
                  // auto set quantity to remaining
                  const item = availableBacklog.find(b => (stage === 'Core' ? `${b.itemId}::${b.coreBoxCode}` : b.itemId) === val)
                  if (item) {
                    setQuantity(Math.max(0, item.totalRequired - item.totalScheduled))
                  }
                }}>
                  <SelectTrigger className="bg-[#050810] border-[#243050] text-[#EEF3FF]">
                    <SelectValue placeholder="Choose from backlog..." />
                  </SelectTrigger>
                  <SelectContent className="bg-[#0C1221] border-[#243050]">
                    {availableBacklog.length === 0 && <SelectItem value="none" disabled>No pending requirements</SelectItem>}
                    {availableBacklog.map(b => {
                      const uniqueId = stage === 'Core' ? `${b.itemId}::${b.coreBoxCode}` : b.itemId
                      return (
                        <SelectItem key={uniqueId} value={uniqueId} className="text-[#EEF3FF]">
                          {b.orderNo} | {b.patternRef} | {b.productName} 
                          {stage === 'Core' && <span className="text-[#D4521A] ml-1">[{b.coreBoxCode}]</span>}
                          <span className="text-[#8B9FC4] ml-2 text-xs">(Rem: {b.totalRequired - b.totalScheduled})</span>
                        </SelectItem>
                      )
                    })}
                  </SelectContent>
                </Select>
              </div>

              {selectedBacklog && (
                <div className="grid grid-cols-2 gap-4 pt-2">
                  <div className="space-y-1.5">
                    <div className="flex justify-between">
                      <Label className="text-[#8B9FC4]">Quantity</Label>
                      <span className="text-xs text-[#4285F4]">Max: {maxAvailable}</span>
                    </div>
                    <Input 
                      type="number" 
                      min="1" 
                      max={maxAvailable}
                      value={quantity}
                      onChange={(e) => setQuantity(e.target.value === '' ? '' : Number(e.target.value))}
                      className="bg-[#050810] border-[#243050] text-[#EEF3FF] font-mono"
                    />
                  </div>
                  
                  <div className="space-y-1.5">
                    <Label className="text-[#8B9FC4]">Laborers Assigned</Label>
                    <Input 
                      type="number" 
                      min="1" 
                      value={laborers}
                      onChange={(e) => setLaborers(e.target.value === '' ? '' : Number(e.target.value))}
                      className="bg-[#050810] border-[#243050] text-[#EEF3FF] font-mono"
                    />
                  </div>
                </div>
              )}

              <Button 
                className="w-full bg-[#D4521A] hover:bg-[#b04213] text-white mt-2"
                onClick={handleAdd}
                disabled={!selectedBacklog || !quantity || Number(quantity) <= 0 || !laborers || Number(laborers) <= 0 || Number(quantity) > maxAvailable}
              >
                Add to Schedule
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
