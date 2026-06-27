'use client'

import { useState, useMemo, useEffect } from 'react'
import { Plus, Minus, X, Trash } from '@phosphor-icons/react'
import { Button } from '@/shared/ui/button'
import { Input } from '@/shared/ui/input'
import { Label } from '@/shared/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select'
import { Badge } from '@/shared/ui/badge'
import { cn } from '@/shared/lib/utils'

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

export function UnifiedMeltCalendar({ activeTab, openOrders, patterns, dailyPlans, onSaveDayPlan }: any) {
  const [selectedDate, setSelectedDate] = useState<string | null>(null) // For tracking drawer
  const [selectedDateForPlanning, setSelectedDateForPlanning] = useState<string | null>(null) // For planning modal
  const [planningHeats, setPlanningHeats] = useState<any[]>([])
  
  const [actualsForms, setActualsForms] = useState<Record<string, any>>({})
  const [draggedHeats, setDraggedHeats] = useState<any[] | null>(null)

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

  const nextHeatNumber = useMemo(() => {
    const count = dailyPlans.filter((p: any) => p.stage === 'Melt').length
    return `H${(count + 1).toString().padStart(3, '0')}`
  }, [dailyPlans])

  const handleDrop = (e: React.DragEvent, targetDate: string) => {
    e.preventDefault()
    if (draggedHeats && draggedHeats.length > 0 && draggedHeats[0].date !== targetDate) {
      const allUpdates = draggedHeats.map(h => ({
        ...h,
        date: targetDate,
        quantityScheduled: h.quantityScheduled || h.meltWeight
      }))
      onSaveDayPlan(targetDate, allUpdates)
    }
    setDraggedHeats(null)
  }

  const handleOpenPlanning = (dateStr: string) => {
    const heats = meltPlansByDate.get(dateStr) || []
    setSelectedDateForPlanning(dateStr)
    setPlanningHeats([...heats])
  }

  const handleAddPlanningHeat = () => {
    const newHeatNo = `H${(dailyPlans.filter((p: any) => p.stage === 'Melt').length + planningHeats.length + 1).toString().padStart(3, '0')}`
    setPlanningHeats([
      ...planningHeats,
      {
        itemId: `manual-${Date.now()}`,
        heatNo: newHeatNo,
        grade: 'FC 200',
        meltWeight: 150,
        startTime: '08:00',
        endTime: '10:30',
        orderId: '',
        orderNo: '-',
        date: selectedDateForPlanning,
        stage: 'Melt'
      }
    ])
  }

  const handleUpdatePlanningHeat = (index: number, field: string, value: any) => {
    const updated = [...planningHeats]
    updated[index] = { ...updated[index], [field]: value }
    if (field === 'orderId') {
      const order = openOrders.find((o: any) => o.id === value)
      updated[index].orderNo = order ? order.customerOrderNo : '-'
      
      // Auto-calculate melt weight based on box weight of products
      if (order && order.cart && order.cart.length > 0) {
        const item = order.cart[0]
        const prodName = item.productName || ''
        const pattern = patterns?.find((p: any) => p.mappedProducts?.some((mp: any) => mp.name === prodName))
        if (pattern) {
          const mp = pattern.mappedProducts.find((m: any) => m.name === prodName)
          const cavities = mp?.cavities || 1
          const moulds = Math.ceil((item.quantity || 1) / cavities)
          const boxWeight = pattern.totalWeight || 0
          updated[index].meltWeight = moulds * boxWeight
        }
      }
    }
    setPlanningHeats(updated)
  }

  const handleRemovePlanningHeat = (index: number) => {
    const updated = [...planningHeats]
    const heat = updated[index]
    if (heat.quantityScheduled !== undefined || heat._id) {
      updated[index] = { ...heat, quantityScheduled: 0, meltWeight: 0 } // Marked for deletion
    } else {
      updated.splice(index, 1) // Just remove if it hasn't been saved to db yet
    }
    setPlanningHeats(updated)
  }

  const handleSavePlanning = () => {
    if (!selectedDateForPlanning) return
    const heatsToSave = planningHeats.map(h => ({
      ...h,
      quantityScheduled: h.meltWeight,
      date: selectedDateForPlanning
    }))
    onSaveDayPlan(selectedDateForPlanning, heatsToSave)
    setSelectedDateForPlanning(null)
  }

  const handleOpenDrawer = (dateStr: string) => {
    const heats = meltPlansByDate.get(dateStr) || []
    const initialForms: Record<string, any> = {}
    heats.forEach(h => {
      initialForms[h.itemId || h.heatNo] = {
        meltWeight: h.actualQuantity || '',
        pigIron: h.actuals?.pigIron || '',
        scrap: h.actuals?.scrap || '',
        feMn: h.actuals?.feMn || '',
        carburizer: h.actuals?.carburizer || ''
      }
    })
    setActualsForms(initialForms)
    setSelectedDate(dateStr)
  }

  const handleActualChange = (heatId: string, field: string, value: string) => {
    setActualsForms(prev => ({
      ...prev,
      [heatId]: { ...prev[heatId], [field]: value }
    }))
  }

  const handleSaveActuals = () => {
    if (!selectedDate) return
    const heats = meltPlansByDate.get(selectedDate) || []
    const updatedHeats = heats.map(h => {
      const form = actualsForms[h.itemId || h.heatNo]
      return {
        ...h,
        actualQuantity: form.meltWeight ? Number(form.meltWeight) : undefined,
        actuals: {
          pigIron: form.pigIron ? Number(form.pigIron) : undefined,
          scrap: form.scrap ? Number(form.scrap) : undefined,
          feMn: form.feMn ? Number(form.feMn) : undefined,
          carburizer: form.carburizer ? Number(form.carburizer) : undefined
        },
        isPending: (form.meltWeight ? Number(form.meltWeight) : 0) < (h.quantityScheduled || h.meltWeight)
      }
    })
    onSaveDayPlan(selectedDate, updatedHeats)
    setSelectedDate(null)
  }

  const dayHeatsForDrawer = selectedDate ? (meltPlansByDate.get(selectedDate) || []) : []
  let drawerPlanned = 0, drawerCompleted = 0, drawerPending = 0
  dayHeatsForDrawer.forEach(h => {
    drawerPlanned++
    if (h.actualQuantity !== undefined && h.actualQuantity > 0) drawerCompleted++
    else drawerPending++
  })
  const drawerCoverage = drawerPlanned > 0 ? (drawerCompleted / drawerPlanned) * 100 : 0

  return (
    <div className="space-y-4 relative">
      {activeTab === 'planning' && (
        <div className="flex justify-end">
          <button
            onClick={() => handleOpenPlanning(new Date().toISOString().split('T')[0])}
            className="bg-[#D4521A] hover:bg-[#E56020] text-white px-5 py-2.5 rounded-lg font-bold shadow-sm flex items-center gap-2 transition-transform hover:scale-105"
          >
            <Plus weight="bold" className="w-4 h-4" />
            New Charge
          </button>
        </div>
      )}
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
            
            let completed = 0, pending = 0
            dayHeats.forEach(h => {
              if (h.actualQuantity !== undefined && h.actualQuantity > 0) completed++
              else pending++
            })

            return (
              <div 
                key={dateStr}
                onDragOver={(e) => { if (activeTab === 'planning') e.preventDefault() }}
                onDrop={(e) => { if (activeTab === 'planning') handleDrop(e, dateStr) }}
                onClick={() => {
                  if (activeTab === 'planning') {
                    handleOpenPlanning(dateStr)
                  } else {
                    if (dayHeats.length > 0) handleOpenDrawer(dateStr)
                  }
                }}
                className={cn(
                  "p-2 transition-colors flex flex-col min-h-[120px] relative group border-[1px]",
                  "bg-[#050810] hover:bg-[#0C1221] border-transparent",
                  !isCurrentMonth && "opacity-50",
                  activeTab === 'planning' && "cursor-pointer hover:border-[#D4521A]/20",
                  activeTab === 'tracking' && dayHeats.length > 0 && "cursor-pointer hover:border-[#374151]"
                )}
              >
                {isToday && <div className="absolute left-0 top-0 bottom-0 w-1 bg-[#D4521A]" />}
                <div className="flex justify-between items-start mb-2 pl-1">
                  <span className={cn("text-sm font-medium w-7 h-7 flex items-center justify-center rounded-full", isToday ? "bg-[#D4521A] text-white" : "text-[#8B9FC4]")}>
                    {date.getDate()}
                  </span>
                </div>
                
                <div className="flex-1 space-y-1 pl-1">
                  {activeTab === 'planning' ? (
                    <>
                      {dayHeats.length > 0 && (
                        <div 
                          draggable
                          onDragStart={(e) => { 
                            e.stopPropagation(); 
                            setDraggedHeats(dayHeats);
                          }}
                          className="px-2 py-1 text-[10px] font-bold uppercase rounded-md bg-[#D4521A] text-white border border-[#D4521A]/50 cursor-grab truncate shadow-md"
                        >
                          PLANNED {dayHeats.length}
                        </div>
                      )}
                      {pending > 0 && (
                        <div 
                          draggable
                          onDragStart={(e) => { 
                            e.stopPropagation(); 
                            setDraggedHeats(dayHeats.filter(h => !h.actualQuantity || h.actualQuantity <= 0));
                          }}
                          className="px-2 py-1 text-[10px] font-bold uppercase rounded-md bg-red-500/10 text-red-500 border border-red-500/20 truncate cursor-grab shadow-md"
                        >
                          PENDING {pending}
                        </div>
                      )}
                    </>
                  ) : (
                    <>
                      {dayHeats.length > 0 && (
                        <div className="px-2 py-1 text-[10px] font-bold uppercase rounded-md bg-[#D4521A]/20 text-[#D4521A] border border-[#D4521A]/30 truncate">
                          PLANNED {dayHeats.length}
                        </div>
                      )}
                      {completed > 0 && (
                        <div className="px-2 py-1 text-[10px] font-bold uppercase rounded-md bg-green-500/20 text-green-500 border border-green-600/30 truncate">
                          DONE {completed}
                        </div>
                      )}
                      {pending > 0 && (
                        <div className="px-2 py-1 text-[10px] font-bold uppercase rounded-md bg-red-500/20 text-red-500 border border-red-500/30 truncate">
                          PENDING {pending}
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* DAILY HEAT PLANNING MODAL */}
      {selectedDateForPlanning && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={() => setSelectedDateForPlanning(null)}>
          <div className="bg-[#111827] border-t-2 border-[#D4521A] rounded-[14px] text-white max-w-5xl w-full flex flex-col shadow-2xl h-[85vh] animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center p-6 border-b border-[#1F2937] shrink-0 bg-[#0C1221] rounded-t-[14px]">
              <div>
                <h2 className="text-2xl font-bold font-heading tracking-tight text-[#EEF3FF]">Daily Heat Plan</h2>
                <p className="text-[#8B9FC4] font-mono text-sm mt-1">{selectedDateForPlanning}</p>
              </div>
              <button onClick={() => setSelectedDateForPlanning(null)} className="text-[#9CA3AF] hover:text-white transition-colors bg-[#1F2937] p-2 rounded-full hover:bg-[#374151]">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-[#050810]">
              {planningHeats.filter(h => h.quantityScheduled !== 0).map((heat, idx) => (
                <div key={heat.itemId || idx} className="bg-[#111827] border border-[#243050] rounded-xl overflow-hidden shadow-sm">
                  <div className="flex items-center gap-4 p-4 border-b border-[#243050] bg-[#0C1221]">
                    <div className="w-8 h-8 rounded-full bg-[#D4521A]/10 text-[#D4521A] flex items-center justify-center font-bold font-mono border border-[#D4521A]/20">
                      {idx + 1}
                    </div>
                    <Input 
                      value={heat.heatNo || ''} 
                      onChange={e => handleUpdatePlanningHeat(idx, 'heatNo', e.target.value)} 
                      className="bg-transparent border-none text-xl font-bold font-heading text-[#EEF3FF] w-32 focus-visible:ring-1 focus-visible:ring-[#D4521A] px-2 h-auto py-1" 
                      placeholder="H001"
                    />
                    <div className="ml-auto flex items-center gap-2">
                      <Button variant="ghost" size="sm" onClick={() => handleRemovePlanningHeat(idx)} className="text-[#9CA3AF] hover:text-red-400 hover:bg-red-500/10">
                        <Trash className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-6 p-6">
                    <div className="space-y-2">
                      <Label className="text-xs font-bold text-[#5A6E90] uppercase tracking-wider">Time Slot</Label>
                      <div className="flex items-center gap-2">
                        <Input 
                          type="time" 
                          value={heat.startTime || '08:00'} 
                          onChange={e => handleUpdatePlanningHeat(idx, 'startTime', e.target.value)} 
                          className="bg-[#1F2937] border-[#374151] text-[#F3F4F6] font-mono h-10" 
                        />
                        <span className="text-[#5A6E90] font-bold">—</span>
                        <Input 
                          type="time" 
                          value={heat.endTime || '10:30'} 
                          onChange={e => handleUpdatePlanningHeat(idx, 'endTime', e.target.value)} 
                          className="bg-[#1F2937] border-[#374151] text-[#F3F4F6] font-mono h-10" 
                        />
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      <Label className="text-xs font-bold text-[#5A6E90] uppercase tracking-wider">Grade</Label>
                      <Select value={heat.grade || 'FC 200'} onValueChange={v => handleUpdatePlanningHeat(idx, 'grade', v)}>
                        <SelectTrigger className="bg-[#1F2937] border-[#374151] text-[#F3F4F6] h-10">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-[#1F2937] border-[#374151]">
                          {ALL_GRADES.map(g => (
                            <SelectItem key={g} value={g} className="text-[#F3F4F6] hover:bg-[#374151]">{g}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div className="space-y-2">
                      <Label className="text-xs font-bold text-[#5A6E90] uppercase tracking-wider">Melt Weight (kg)</Label>
                      <Input 
                        type="number" 
                        value={heat.meltWeight || heat.quantityScheduled || 150} 
                        onChange={e => handleUpdatePlanningHeat(idx, 'meltWeight', Number(e.target.value))} 
                        className="bg-[#1F2937] border-[#374151] text-[#F3F4F6] font-mono h-10" 
                      />
                    </div>

                    <div className="space-y-2">
                      <Label className="text-xs font-bold text-[#5A6E90] uppercase tracking-wider">Target Sales Order</Label>
                      <Select value={heat.orderId || ''} onValueChange={v => handleUpdatePlanningHeat(idx, 'orderId', v)}>
                        <SelectTrigger className="bg-[#1F2937] border-[#374151] text-[#F3F4F6] h-10">
                          <SelectValue placeholder="Select order..." />
                        </SelectTrigger>
                        <SelectContent className="bg-[#1F2937] border-[#374151]">
                          {openOrders.map((o: any) => (
                            <SelectItem key={o.id} value={o.id} className="text-[#F3F4F6] hover:bg-[#374151]">{o.customerOrderNo}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
              ))}
              
              {planningHeats.filter(h => h.quantityScheduled !== 0).length === 0 && (
                <div className="text-center text-[#5A6E90] py-20 bg-[#111827] border border-[#243050] rounded-xl border-dashed">
                  No heats planned for this date.
                </div>
              )}

              <Button 
                variant="outline" 
                onClick={handleAddPlanningHeat} 
                className="w-full border-dashed border-[#D4521A]/50 text-[#D4521A] hover:bg-[#D4521A]/10 hover:text-[#E56020] hover:border-[#D4521A] h-14 bg-transparent mt-4"
              >
                <Plus className="w-5 h-5 mr-2" weight="bold" />
                Add Heat Slot
              </Button>
            </div>
            
            <div className="p-6 border-t border-[#1F2937] bg-[#0C1221] rounded-b-[14px] flex justify-between items-center shrink-0">
              <div className="text-[#5A6E90] text-sm">
                Total Planned Weight: <span className="text-[#EEF3FF] font-mono font-bold ml-1">{planningHeats.filter(h => h.quantityScheduled !== 0).reduce((acc, curr) => acc + (curr.meltWeight || curr.quantityScheduled || 0), 0)} kg</span>
              </div>
              <div className="flex gap-3">
                <Button variant="outline" onClick={() => setSelectedDateForPlanning(null)} className="border-[#374151] text-[#9CA3AF] hover:text-white bg-transparent">CANCEL</Button>
                <Button onClick={handleSavePlanning} className="bg-[#D4521A] hover:bg-[#E56020] text-white uppercase font-bold tracking-wider px-8 shadow-lg shadow-[#D4521A]/20">SAVE DAY PLAN</Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {selectedDate && activeTab === 'tracking' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={() => setSelectedDate(null)}>
          <div className="bg-[#111827] border-t-2 border-[#D4521A] rounded-[14px] text-white max-w-4xl w-full flex flex-col shadow-2xl max-h-[85vh] animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
            <div className="p-6 border-b border-[#1F2937] bg-[#0C1221] rounded-t-[14px] flex justify-between items-start shrink-0">
              <div>
                <h2 className="text-xl font-bold text-[#F3F4F6] font-mono tracking-tight">{selectedDate}</h2>
                <Badge variant="outline" className="mt-2 border-[#D4521A]/30 text-[#D4521A] bg-[#D4521A]/10 uppercase text-[10px] font-bold tracking-wider">
                  MELT TRACKING
                </Badge>
              </div>
              <button onClick={() => setSelectedDate(null)} className="text-[#9CA3AF] hover:text-white transition-colors bg-[#1F2937] p-2 rounded-full hover:bg-[#374151]">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-[#050810] p-6 border-b border-[#374151] shrink-0">
              <div className="flex justify-between items-center text-sm font-medium mb-3">
                <div className="text-[#F3F4F6]">Planned: {drawerPlanned}</div>
                <div className="text-green-400">Done: {drawerCompleted}</div>
                <div className="text-red-400">Pending: {drawerPending}</div>
              </div>
              <div className="flex justify-between items-center mb-1">
                <span className="text-xs text-[#9CA3AF] uppercase font-bold tracking-wider">Coverage</span>
                <span className="text-xs text-[#F3F4F6] font-bold font-mono">{drawerCoverage.toFixed(0)}%</span>
              </div>
              <div className="w-full bg-[#111827] rounded-full h-2">
                <div className={cn("h-2 rounded-full", drawerCoverage === 100 ? "bg-green-500" : "bg-amber-500")} style={{ width: `${drawerCoverage}%` }} />
              </div>
            </div>
            
            <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-[#050810]">
              {dayHeatsForDrawer.map((heat, idx) => {
                const heatId = heat.itemId || heat.heatNo
                const form = actualsForms[heatId] || {}
                const weight = heat.quantityScheduled || heat.meltWeight || 150
                const rec = RECIPES[heat.grade] || RECIPES['FC 200']
                
                const pPig = heat.plannedCharge?.pigIron ?? (weight * rec.pigIron / 100)
                const pScrap = heat.plannedCharge?.scrap ?? (weight * rec.scrap / 100)
                const pFeMn = heat.plannedCharge?.feMn ?? (weight * rec.feMn / 100)
                const pCarb = heat.plannedCharge?.carburizer ?? (weight * rec.carburizer / 100)
                
                const aPig = form.pigIron ? Number(form.pigIron) : 0
                const aScrap = form.scrap ? Number(form.scrap) : 0
                const aFeMn = form.feMn ? Number(form.feMn) : 0
                const aCarb = form.carburizer ? Number(form.carburizer) : 0

                const varPig = aPig ? pPig - aPig : 0
                const varScrap = aScrap ? pScrap - aScrap : 0
                const varFeMn = aFeMn ? pFeMn - aFeMn : 0
                const varCarb = aCarb ? pCarb - aCarb : 0
                
                const formatVar = (v: number) => {
                  if (v === 0) return <span className="text-[#6B7280]">0</span>
                  if (v > 0) return <span className="text-green-500">+{v.toFixed(1)}</span>
                  return <span className="text-red-500">{v.toFixed(1)}</span>
                }

                return (
                  <details key={idx} className="group bg-[#1F2937] border border-[#374151] rounded-lg overflow-hidden" open={idx === 0}>
                    <summary className="p-3 cursor-pointer select-none bg-[#1F2937] hover:bg-[#374151] transition-colors flex items-center justify-between outline-none">
                      <div className="flex items-center gap-3">
                        <span className="font-bold text-[#F3F4F6] font-mono">{heat.heatNo || `H00${idx+1}`}</span>
                        <Badge variant="outline" className="border-[#4B5563] text-[#D1D5DB] bg-[#111827] text-[10px] uppercase">
                          {heat.grade}
                        </Badge>
                      </div>
                      <div className="text-[#9CA3AF] text-sm font-mono">{weight}kg</div>
                    </summary>
                    <div className="p-4 border-t border-[#374151] bg-[#111827] space-y-4">
                      <div className="grid grid-cols-[80px_1fr_1fr_1fr] gap-2 items-center text-xs">
                        <div className="font-semibold text-[#6B7280] uppercase">Plan</div>
                        <div className="text-[#9CA3AF] font-mono text-center">Pig {pPig.toFixed(1)}</div>
                        <div className="text-[#9CA3AF] font-mono text-center">Scrap {pScrap.toFixed(1)}</div>
                        <div className="text-[#9CA3AF] font-mono text-center">FeMn {pFeMn.toFixed(1)}</div>
                      </div>
                      
                      <div className="grid grid-cols-[80px_1fr_1fr_1fr] gap-2 items-center text-xs">
                        <div className="font-semibold text-[#F3F4F6] uppercase">Actual</div>
                        <Input value={form.pigIron} onChange={e => handleActualChange(heatId, 'pigIron', e.target.value)} className="h-7 text-center font-mono bg-[#1F2937] border-[#374151] text-[#F3F4F6] px-1" placeholder="0" />
                        <Input value={form.scrap} onChange={e => handleActualChange(heatId, 'scrap', e.target.value)} className="h-7 text-center font-mono bg-[#1F2937] border-[#374151] text-[#F3F4F6] px-1" placeholder="0" />
                        <Input value={form.feMn} onChange={e => handleActualChange(heatId, 'feMn', e.target.value)} className="h-7 text-center font-mono bg-[#1F2937] border-[#374151] text-[#F3F4F6] px-1" placeholder="0" />
                      </div>

                      <div className="grid grid-cols-[80px_1fr_1fr_1fr] gap-2 items-center text-xs">
                        <div className="font-semibold text-[#6B7280] uppercase">Var</div>
                        <div className="font-mono text-center">{formatVar(varPig)}</div>
                        <div className="font-mono text-center">{formatVar(varScrap)}</div>
                        <div className="font-mono text-center">{formatVar(varFeMn)}</div>
                      </div>

                      <div className="h-px w-full bg-[#374151] my-2" />
                      
                      <div className="flex items-center justify-between">
                        <Label className="text-xs text-[#9CA3AF] uppercase font-bold">Heats Completed</Label>
                        <div className="flex items-center gap-2">
                          <Input 
                            type="number" 
                            value={form.meltWeight} 
                            onChange={e => handleActualChange(heatId, 'meltWeight', e.target.value)} 
                            className="w-20 h-8 text-center font-mono font-bold bg-[#1F2937] border-[#374151] text-[#F3F4F6]" 
                          />
                          <span className="text-[#6B7280] text-sm">/ {weight}kg</span>
                        </div>
                      </div>
                    </div>
                  </details>
                )
              })}
              {dayHeatsForDrawer.length === 0 && (
                <div className="text-center text-[#5A6E90] py-20 bg-[#111827] border border-[#243050] rounded-xl border-dashed">
                  No heats scheduled for this date.
                </div>
              )}
            </div>

            <div className="p-6 border-t border-[#1F2937] bg-[#0C1221] rounded-b-[14px] flex justify-end gap-3 shrink-0">
              <Button variant="outline" onClick={() => setSelectedDate(null)} className="border-[#374151] text-[#9CA3AF] hover:text-white bg-transparent">CANCEL</Button>
              <Button onClick={handleSaveActuals} className="bg-[#D4521A] hover:bg-[#E56020] text-white uppercase font-bold tracking-wider px-8 shadow-lg shadow-[#D4521A]/20">SAVE ACTUALS</Button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
