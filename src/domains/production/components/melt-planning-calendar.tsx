'use client'

import { useState, useMemo, useEffect } from 'react'
import { Plus, Minus, X } from '@phosphor-icons/react'
import { Button } from '@/shared/ui/button'
import { Input } from '@/shared/ui/input'
import { Label } from '@/shared/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select'
import { Badge } from '@/shared/ui/badge'
import { cn } from '@/shared/lib/utils'

// Shared Configuration
const RECIPES: Record<string, { pigIron: number, scrap: number, feMn: number, carburizer: number }> = {
  'FC 200': { pigIron: 35, scrap: 60, feMn: 2, carburizer: 3 },
  'FC 250': { pigIron: 35, scrap: 60, feMn: 2, carburizer: 3 },
  'FC 300': { pigIron: 35, scrap: 60, feMn: 2, carburizer: 3 },
  'FC 350': { pigIron: 30, scrap: 65, feMn: 2, carburizer: 3 },
  'SG 400': { pigIron: 45, scrap: 47, feMn: 3, carburizer: 5 },
  'SG 500': { pigIron: 45, scrap: 47, feMn: 3, carburizer: 5 },
  'SG 600': { pigIron: 50, scrap: 42, feMn: 3, carburizer: 5 },
}
const ALL_GRADES = Object.keys(RECIPES)

export function MeltPlanningCalendar({ openOrders, patterns, dailyPlans, onSaveDayPlan }: any) {
  const [selectedHeat, setSelectedHeat] = useState<any | null>(null)
  const [selectedHeatForm, setSelectedHeatForm] = useState<any>({})
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [addDate, setAddDate] = useState<string>('')

  // Add Heat Form State
  const [addHeatForm, setAddHeatForm] = useState({
    grade: 'FC 200',
    meltWeight: 150,
    heatNo: '',
    salesOrder: ''
  })

  // Calendar logic
  const getDays = () => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const year = today.getFullYear()
    const month = today.getMonth()
    const firstDay = new Date(year, month, 1)
    const startOffset = firstDay.getDay() === 0 ? 6 : firstDay.getDay() - 1
    
    const startDate = new Date(firstDay)
    startDate.setDate(firstDay.getDate() - startOffset)
    
    return Array.from({ length: 42 }, (_, i) => {
      const d = new Date(startDate)
      d.setDate(startDate.getDate() + i)
      return d
    })
  }
  const days = getDays()
  const weekDays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

  // Group melt plans by date
  const meltPlansByDate = useMemo(() => {
    const map = new Map<string, any[]>()
    dailyPlans.forEach((p: any) => {
      if (p.stage === 'Melt') {
        if (!map.has(p.date)) map.set(p.date, [])
        map.get(p.date)!.push(p)
      }
    })
    return map
  }, [dailyPlans])

  // Get total heats for auto-numbering
  const nextHeatNumber = useMemo(() => {
    const count = dailyPlans.filter((p: any) => p.stage === 'Melt').length
    return `H${(count + 1).toString().padStart(3, '0')}`
  }, [dailyPlans])

  useEffect(() => {
    if (isAddModalOpen) {
      setAddHeatForm(prev => ({ ...prev, heatNo: nextHeatNumber }))
    }
  }, [isAddModalOpen, nextHeatNumber])

  // Drag and drop state
  const [draggedHeat, setDraggedHeat] = useState<any | null>(null)

  const handleDrop = (e: React.DragEvent, targetDate: string) => {
    e.preventDefault()
    if (draggedHeat && draggedHeat.date !== targetDate) {
      const updatedHeat = { ...draggedHeat, date: targetDate, quantityScheduled: draggedHeat.quantityScheduled || draggedHeat.meltWeight }
      onSaveDayPlan(targetDate, [updatedHeat])
    }
    setDraggedHeat(null)
  }

  const handleSaveAddHeat = () => {
    const order = openOrders.find((o: any) => o.id === addHeatForm.salesOrder)
    
    const newHeat = {
      heatNo: addHeatForm.heatNo,
      grade: addHeatForm.grade,
      meltWeight: addHeatForm.meltWeight,
      quantityScheduled: addHeatForm.meltWeight, // keep compat
      stage: 'Melt',
      date: addDate,
      orderId: addHeatForm.salesOrder,
      orderNo: order ? order.customerOrderNo : '-',
      itemId: `manual-${Date.now()}`
    }
    
    // Combine with existing dailyPlans to simulate an update/save that doesn't overwrite others on the same date
    onSaveDayPlan(addDate, [newHeat])
    setIsAddModalOpen(false)
  }

  const handleRemoveHeat = (e: React.MouseEvent, dateStr: string, dayHeats: any[]) => {
    e.stopPropagation()
    // Find the last heat for this day and "remove" it by saving a plan with quantity 0 or filtering it out.
    // In our simplified logic, since we don't have a delete API, we'll just alert or if we can pass a deleted flag we do.
    // Assuming backend deletes it if quantity is 0 or if we have an onDelete prop.
    // For now we will just use a mock alert as we need a proper backend endpoint to delete.
    if (dayHeats.length > 0) {
      const heatToRemove = dayHeats[dayHeats.length - 1]
      onSaveDayPlan(dateStr, [{ ...heatToRemove, quantityScheduled: 0 }])
    }
  }

  // Helper to resolve product details for heat
  const getProductDetails = (heat: any) => {
    // If we have an itemId, we could look it up in openOrders. For now we mock based on the first item in the order
    const order = openOrders.find((o: any) => o.id === heat.orderId || o.customerOrderNo === heat.orderNo)
    let prodName = 'N/A', patternRef = 'N/A', moulds = 0, coreBoxRef = 'N/A'
    
    if (order && order.cart && order.cart.length > 0) {
      const item = order.cart[0]
      prodName = item.productName || 'N/A'
      const pattern = patterns.find((p: any) => p.mappedProducts?.some((mp: any) => mp.name === prodName))
      if (pattern) {
        patternRef = pattern.code
        const mp = pattern.mappedProducts.find((m: any) => m.name === prodName)
        const cavities = mp?.cavities || 1
        moulds = Math.ceil((item.quantity || 1) / cavities)
        coreBoxRef = mp?.selectedCoreBoxes?.[0]?.coreBoxCode || 'Legacy'
      }
    }
    
    return { prodName, patternRef, moulds, coreBoxRef }
  }

  const handleHeatSelect = (heat: any) => {
    setSelectedHeat(heat)
    const rec = RECIPES[heat.grade] || RECIPES['FC 200']
    const weight = heat.quantityScheduled || heat.meltWeight || 150
    setSelectedHeatForm({
      pigIron: heat.plannedCharge?.pigIron ?? (weight * rec.pigIron / 100).toFixed(1),
      scrap: heat.plannedCharge?.scrap ?? (weight * rec.scrap / 100).toFixed(1),
      feMn: heat.plannedCharge?.feMn ?? (weight * rec.feMn / 100).toFixed(1),
      carburizer: heat.plannedCharge?.carburizer ?? (weight * rec.carburizer / 100).toFixed(1),
    })
  }

  const handleSavePlannedCharge = () => {
    if (!selectedHeat) return
    const updatedHeat = {
      ...selectedHeat,
      plannedCharge: {
        pigIron: Number(selectedHeatForm.pigIron),
        scrap: Number(selectedHeatForm.scrap),
        feMn: Number(selectedHeatForm.feMn),
        carburizer: Number(selectedHeatForm.carburizer),
      }
    }
    onSaveDayPlan(selectedHeat.date, [updatedHeat])
    setSelectedHeat(null)
  }

  return (
    <div className="space-y-6 relative">
      <div className="bg-[#050810] border border-[#243050] rounded-xl overflow-hidden flex flex-col">
        <div className="grid grid-cols-7 border-b border-[#243050] bg-[#0C1221]">
          {weekDays.map(day => (
            <div key={day} className="py-3 text-center text-xs font-semibold text-[#8B9FC4] uppercase tracking-wider">
              {day}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7 bg-[#243050] gap-[1px] flex-1">
          {days.map((date, i) => {
            const dateStr = date.toISOString().split('T')[0]
            const isToday = new Date().toISOString().split('T')[0] === dateStr
            const isCurrentMonth = date.getMonth() === new Date().getMonth()
            
            const dayHeats = meltPlansByDate.get(dateStr) || []
            const pendingHeats = dayHeats.filter(h => h.isPending) // Assuming isPending is a flag set during actuals

            return (
              <div 
                key={dateStr}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => handleDrop(e, dateStr)}
                className={cn(
                  "bg-[#050810] p-2 hover:bg-[#0C1221] transition-colors flex flex-col min-h-[120px] relative group",
                  !isCurrentMonth && "opacity-50"
                )}
              >
                <div className="flex justify-between items-start mb-2">
                  <span className={cn(
                    "text-sm font-medium w-7 h-7 flex items-center justify-center rounded-full",
                    isToday ? "bg-[#D4521A] text-white" : "text-[#8B9FC4]"
                  )}>
                    {date.getDate()}
                  </span>
                  
                  {/* Hover Action Buttons */}
                  <div className="opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                    {dayHeats.length > 0 && (
                      <button 
                        onClick={(e) => handleRemoveHeat(e, dateStr, dayHeats)}
                        className="w-6 h-6 rounded-md bg-red-500/10 text-red-500 hover:bg-red-500/20 flex items-center justify-center transition-colors"
                      >
                        <Minus weight="bold" className="w-3 h-3" />
                      </button>
                    )}
                    <button 
                      onClick={() => { setAddDate(dateStr); setIsAddModalOpen(true) }}
                      className="w-6 h-6 rounded-md bg-[#D4521A]/10 text-[#D4521A] hover:bg-[#D4521A]/20 flex items-center justify-center transition-colors"
                    >
                      <Plus weight="bold" className="w-3 h-3" />
                    </button>
                  </div>
                </div>
                
                <div className="flex-1 space-y-1">
                  {dayHeats.length > 0 && (
                    <div 
                      draggable
                      onDragStart={() => setDraggedHeat(dayHeats[0])}
                      onClick={() => handleHeatSelect(dayHeats[0])}
                      className="px-2 py-1 text-[10px] font-bold uppercase rounded-md bg-[#D4521A]/10 text-[#D4521A] border border-[#D4521A]/20 cursor-pointer truncate"
                    >
                      HEATS {dayHeats.length}
                    </div>
                  )}
                  {pendingHeats.length > 0 && (
                    <div className="px-2 py-1 text-[10px] font-bold uppercase rounded-md bg-red-500/10 text-red-500 border border-red-500/20 truncate">
                      PENDING {pendingHeats.length}
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* HEAT POPUP CARD */}
      {selectedHeat && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={() => setSelectedHeat(null)}>
          <div className="bg-[#050810] border border-[#243050] rounded-xl text-white max-w-2xl w-full flex flex-col shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center p-4 border-b border-[#243050] shrink-0 bg-[#0C1221] rounded-t-xl">
              <div className="flex items-center gap-3">
                <h2 className="text-xl font-bold font-mono text-[#EEF3FF]">{selectedHeat.heatNo || 'H---'}</h2>
                <Badge variant="outline" className="border-[#D4521A]/30 text-[#D4521A] bg-[#D4521A]/10">
                  {selectedHeat.grade || 'FC 200'}
                </Badge>
                <span className="text-[#8B9FC4] text-sm font-mono">{selectedHeat.date}</span>
              </div>
              <button onClick={() => setSelectedHeat(null)} className="text-[#8B9FC4] hover:text-white transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 space-y-8 overflow-y-auto max-h-[75vh]">
              {/* SECTION 1: Pour Details */}
              <div className="space-y-4">
                <Label className="text-xs font-bold text-[#5A6E90] uppercase tracking-wider">PRODUCTS BEING POURED</Label>
                <div className="bg-[#0C1221] border border-[#243050] rounded-lg overflow-hidden">
                  <table className="w-full text-sm text-left">
                    <thead className="bg-[#1A263D]/50 border-b border-[#243050] text-[#8B9FC4] text-xs">
                      <tr>
                        <th className="px-4 py-2 font-semibold">Product Name</th>
                        <th className="px-4 py-2 font-semibold">Pattern Ref</th>
                        <th className="px-4 py-2 font-semibold text-center">Moulds</th>
                        <th className="px-4 py-2 font-semibold">Core Box Ref</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#243050]">
                      {(() => {
                        const { prodName, patternRef, moulds, coreBoxRef } = getProductDetails(selectedHeat)
                        return (
                          <tr>
                            <td className="px-4 py-3 font-medium text-[#EEF3FF]">{prodName}</td>
                            <td className="px-4 py-3 font-mono text-[#8B9FC4]">{patternRef}</td>
                            <td className="px-4 py-3 text-center font-mono font-bold text-[#4285F4]">{moulds}</td>
                            <td className="px-4 py-3 font-mono text-[#8B9FC4]">{coreBoxRef}</td>
                          </tr>
                        )
                      })()}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* SECTION 2: Charge Plan */}
              <div className="space-y-4">
                <Label className="text-xs font-bold text-[#5A6E90] uppercase tracking-wider">CHARGE PLAN</Label>
                <div className="bg-[#0C1221] border border-[#243050] rounded-lg p-4 space-y-3">
                  {(() => {
                    const rec = RECIPES[selectedHeat.grade] || RECIPES['FC 200']
                    const weight = selectedHeat.meltWeight || selectedHeat.quantityScheduled || 150
                    return (
                      <>
                        <div className="flex items-center justify-between text-sm">
                          <Label className="text-[#8B9FC4]">Pig Iron <span className="text-[#5A6E90] font-normal text-xs ml-1">({rec.pigIron}%)</span></Label>
                          <div className="flex items-center gap-2">
                            <Input 
                              type="number"
                              value={selectedHeatForm.pigIron}
                              onChange={(e) => setSelectedHeatForm(prev => ({...prev, pigIron: e.target.value}))}
                              className="h-8 w-24 px-2 text-right bg-[#050810] border-[#243050] text-[#EEF3FF] font-mono text-sm [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                            />
                            <span className="text-[#5A6E90] text-xs font-mono w-4">kg</span>
                          </div>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                          <Label className="text-[#8B9FC4]">Scrap <span className="text-[#5A6E90] font-normal text-xs ml-1">({rec.scrap}%)</span></Label>
                          <div className="flex items-center gap-2">
                            <Input 
                              type="number"
                              value={selectedHeatForm.scrap}
                              onChange={(e) => setSelectedHeatForm(prev => ({...prev, scrap: e.target.value}))}
                              className="h-8 w-24 px-2 text-right bg-[#050810] border-[#243050] text-[#EEF3FF] font-mono text-sm [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                            />
                            <span className="text-[#5A6E90] text-xs font-mono w-4">kg</span>
                          </div>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                          <Label className="text-[#8B9FC4]">FeMn <span className="text-[#5A6E90] font-normal text-xs ml-1">({rec.feMn}%)</span></Label>
                          <div className="flex items-center gap-2">
                            <Input 
                              type="number"
                              value={selectedHeatForm.feMn}
                              onChange={(e) => setSelectedHeatForm(prev => ({...prev, feMn: e.target.value}))}
                              className="h-8 w-24 px-2 text-right bg-[#050810] border-[#243050] text-[#EEF3FF] font-mono text-sm [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                            />
                            <span className="text-[#5A6E90] text-xs font-mono w-4">kg</span>
                          </div>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                          <Label className="text-[#8B9FC4]">Carburizer <span className="text-[#5A6E90] font-normal text-xs ml-1">({rec.carburizer}%)</span></Label>
                          <div className="flex items-center gap-2">
                            <Input 
                              type="number"
                              value={selectedHeatForm.carburizer}
                              onChange={(e) => setSelectedHeatForm(prev => ({...prev, carburizer: e.target.value}))}
                              className="h-8 w-24 px-2 text-right bg-[#050810] border-[#243050] text-[#EEF3FF] font-mono text-sm [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                            />
                            <span className="text-[#5A6E90] text-xs font-mono w-4">kg</span>
                          </div>
                        </div>
                        <div className="pt-3 mt-1 border-t border-[#243050] flex justify-between items-center">
                          <span className="text-[#EEF3FF] font-bold">Total Melt Weight</span>
                          <span className="font-mono text-[#D4521A] font-bold text-lg">{weight.toFixed(1)} kg</span>
                        </div>
                      </>
                    )
                  })()}
                </div>
              </div>

              {/* SECTION 3: Shift Assignment */}
              <div className="space-y-4">
                <Label className="text-xs font-bold text-[#5A6E90] uppercase tracking-wider">SHIFT ASSIGNMENT</Label>
                <div className="bg-[#0C1221] border border-[#243050] rounded-lg p-4 grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <div>
                    <p className="text-xs text-[#8B9FC4] mb-1">Start Time</p>
                    <p className="font-mono text-[#EEF3FF]">08:00 AM</p>
                  </div>
                  <div>
                    <p className="text-xs text-[#8B9FC4] mb-1">End Time</p>
                    <p className="font-mono text-[#EEF3FF]">09:00 AM</p>
                  </div>
                  <div>
                    <p className="text-xs text-[#8B9FC4] mb-1">Assigned Workers</p>
                    <div className="flex items-center gap-2">
                      <button className="w-6 h-6 bg-[#1A263D] border border-[#243050] rounded flex items-center justify-center text-[#8B9FC4]">-</button>
                      <span className="font-mono text-[#EEF3FF] w-4 text-center">2</span>
                      <button className="w-6 h-6 bg-[#1A263D] border border-[#243050] rounded flex items-center justify-center text-[#8B9FC4]">+</button>
                    </div>
                  </div>
                  <div>
                    <p className="text-xs text-[#8B9FC4] mb-1">Expected Completion</p>
                    <p className="font-mono text-green-400">100% On Track</p>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="p-4 border-t border-[#243050] bg-[#0C1221] rounded-b-xl flex justify-end gap-3 shrink-0">
              <Button variant="ghost" onClick={() => setSelectedHeat(null)} className="text-[#8B9FC4] hover:text-[#EEF3FF] hover:bg-[#1A263D]">Cancel</Button>
              <Button onClick={handleSavePlannedCharge} className="bg-[#D4521A] hover:bg-[#E56020] text-white">Save Changes</Button>
            </div>
          </div>
        </div>
      )}

      {/* ADD HEAT MODAL */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={() => setIsAddModalOpen(false)}>
          <div className="bg-[#050810] border border-[#243050] rounded-xl text-white max-w-md w-full shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="p-6 border-b border-[#243050]">
              <h2 className="text-xl font-bold text-[#EEF3FF]">Add Heat</h2>
              <p className="text-[#8B9FC4] text-sm font-mono mt-1">{addDate}</p>
            </div>
            <div className="p-6 space-y-5">
              <div className="space-y-2">
                <Label className="text-[#8B9FC4]">Heat Number</Label>
                <Input 
                  value={addHeatForm.heatNo} 
                  onChange={e => setAddHeatForm({...addHeatForm, heatNo: e.target.value})} 
                  className="bg-[#0C1221] border-[#243050] font-mono text-[#4285F4]"
                />
              </div>
              
              <div className="space-y-2">
                <Label className="text-[#8B9FC4]">Grade</Label>
                <Select value={addHeatForm.grade} onValueChange={(val) => setAddHeatForm({...addHeatForm, grade: val})}>
                  <SelectTrigger className="bg-[#0C1221] border-[#243050] text-[#EEF3FF]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-[#0C1221] border-[#243050]">
                    {ALL_GRADES.map(g => (
                      <SelectItem key={g} value={g} className="text-[#EEF3FF] hover:bg-[#1A263D]">{g}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="text-[#8B9FC4]">Melt Weight (kg)</Label>
                <Input 
                  type="number"
                  value={addHeatForm.meltWeight} 
                  onChange={e => setAddHeatForm({...addHeatForm, meltWeight: Number(e.target.value)})} 
                  className="bg-[#0C1221] border-[#243050] text-[#EEF3FF]"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-[#8B9FC4]">Sales Order</Label>
                <Select value={addHeatForm.salesOrder} onValueChange={(val) => setAddHeatForm({...addHeatForm, salesOrder: val})}>
                  <SelectTrigger className="bg-[#0C1221] border-[#243050] text-[#EEF3FF]">
                    <SelectValue placeholder="Select order..." />
                  </SelectTrigger>
                  <SelectContent className="bg-[#0C1221] border-[#243050]">
                    {openOrders.map((o: any) => (
                      <SelectItem key={o.id} value={o.id} className="text-[#EEF3FF] hover:bg-[#1A263D]">
                        <span className="font-mono text-[#4285F4] mr-2">{o.customerOrderNo}</span> {o.customer}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <div className="p-6 border-t border-[#243050] flex justify-end gap-3 bg-[#0C1221] rounded-b-xl">
              <Button variant="ghost" onClick={() => setIsAddModalOpen(false)} className="text-[#8B9FC4] hover:text-white">Cancel</Button>
              <Button onClick={handleSaveAddHeat} className="bg-[#D4521A] hover:bg-[#E56020] text-white">Save Heat</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
