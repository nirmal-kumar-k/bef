'use client'

import { useState, useMemo, useEffect } from 'react'
import { Plus, Minus, X, Trash, ListPlus } from '@phosphor-icons/react'
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

export function UnifiedMeltCalendar({ activeTab, openOrders, products, patterns, dailyPlans, onSaveDayPlan }: any) {
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [selectedDateForPlanning, setSelectedDateForPlanning] = useState<string | null>(null)
  const [planningHeats, setPlanningHeats] = useState<any[]>([])
  
  const [actualsForms, setActualsForms] = useState<Record<string, any>>({})
  const [draggedHeats, setDraggedHeats] = useState<any[] | null>(null)

  const [furnaces, setFurnaces] = useState<any[]>([])
  const [activeFurnaceTab, setActiveFurnaceTab] = useState<string>('')
  
  const [allocationModalOpen, setAllocationModalOpen] = useState<{ idx: number, grade: string } | null>(null)

  useEffect(() => {
    fetch('/api/equipment')
      .then(res => res.json())
      .then(data => {
        const furns = data.filter((e: any) => e.type === 'Furnace' && e.isActive)
        setFurnaces(furns)
        if (furns.length > 0) setActiveFurnaceTab(furns[0].id)
      })
      .catch(console.error)
  }, [])

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

  const mouldBacklogs = useMemo(() => {
    const list: any[] = []
    openOrders?.forEach((order: any) => {
      order.cart?.forEach((item: any, idx: number) => {
        const uniqueId = `${order.id || order._id}-${idx}`
        const product = products?.find((p: any) => p.name === item.productName || p.code === item.product)
        const pattern = patterns?.find((p: any) => p.mappedProducts?.some((mp: any) => mp.name === product?.name))
        
        const produced = dailyPlans.filter((p: any) => p.stage === 'Mould' && p.itemId === uniqueId)
          .reduce((sum: number, p: any) => sum + (p.actualQuantity ?? p.quantityScheduled ?? 0), 0)
        
        const poured = dailyPlans.filter((p: any) => p.stage === 'Melt' && p.allocations?.some((a: any) => a.itemId === uniqueId))
          .reduce((sum: number, p: any) => {
            const alloc = p.allocations.find((a: any) => a.itemId === uniqueId)
            return sum + (alloc?.moulds || 0)
          }, 0)

        list.push({
          itemId: uniqueId,
          orderNo: order.customerOrderNo,
          productName: item.productName,
          grade: product?.grade || 'FC 200',
          boxWeight: pattern?.totalWeight || 0,
          producedMoulds: produced,
          pouredMoulds: poured,
          availableMoulds: Math.max(0, produced - poured)
        })
      })
    })
    return list
  }, [openOrders, products, patterns, dailyPlans])

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

  const recalculateTimings = (heats: any[], startIndex: number, furnId: string) => {
    const furnace = furnaces.find(f => f.id === furnId)
    if (!furnace) return heats
    const updated = [...heats]
    
    for (let i = startIndex; i < updated.length; i++) {
      if (i > 0) {
        updated[i].startTime = updated[i - 1].endTime
      }
      const durationMins = i === 0 ? (furnace.firstHeatDurationMins || 120) : (furnace.regularHeatDurationMins || 90)
      const [sh, sm] = (updated[i].startTime || '08:00').split(':').map(Number)
      let endMins = (sm || 0) + durationMins
      let endHrs = (sh || 8) + Math.floor(endMins / 60)
      endMins = endMins % 60
      endHrs = endHrs % 24
      updated[i].endTime = `${endHrs.toString().padStart(2, '0')}:${endMins.toString().padStart(2, '0')}`
    }
    return updated
  }

  const handleAddPlanningHeat = () => {
    const furnaceHeats = planningHeats.filter(h => h.equipmentId === activeFurnaceTab && h.quantityScheduled !== 0)
    const newHeatNo = `H${(dailyPlans.filter((p: any) => p.stage === 'Melt').length + planningHeats.length + 1).toString().padStart(3, '0')}`
    
    let startTime = '08:00'
    if (furnaceHeats.length > 0) {
      startTime = furnaceHeats[furnaceHeats.length - 1].endTime || '10:00'
    }

    let updated = [
      ...planningHeats,
      {
        itemId: `manual-${Date.now()}`,
        heatNo: newHeatNo,
        grade: 'FC 200',
        meltWeight: 0,
        startTime,
        endTime: '', // will be set by recalculate
        equipmentId: activeFurnaceTab,
        allocations: [],
        date: selectedDateForPlanning,
        stage: 'Melt'
      }
    ]
    
    const allFurnaceHeats = updated.filter(h => h.equipmentId === activeFurnaceTab && h.quantityScheduled !== 0)
    const recalculated = recalculateTimings(allFurnaceHeats, 0, activeFurnaceTab)
    
    updated = updated.map(h => {
       if (h.equipmentId === activeFurnaceTab && h.quantityScheduled !== 0) {
         return recalculated.find(r => r.itemId === h.itemId) || h
       }
       return h
    })

    setPlanningHeats(updated)
  }

  const handleUpdatePlanningHeat = (index: number, field: string, value: any) => {
    let updated = [...planningHeats]
    updated[index] = { ...updated[index], [field]: value }
    
    if (field === 'startTime' || field === 'endTime') {
       if (field === 'startTime') {
         const furnace = furnaces.find(f => f.id === activeFurnaceTab)
         const furnaceHeats = updated.filter(h => h.equipmentId === activeFurnaceTab && h.quantityScheduled !== 0)
         const heatIdxInFurnace = furnaceHeats.findIndex(h => h.itemId === updated[index].itemId)
         const durationMins = heatIdxInFurnace === 0 ? (furnace?.firstHeatDurationMins || 120) : (furnace?.regularHeatDurationMins || 90)
         const [sh, sm] = value.split(':').map(Number)
         let endMins = sm + durationMins
         let endHrs = sh + Math.floor(endMins / 60)
         endMins = endMins % 60
         endHrs = endHrs % 24
         updated[index].endTime = `${endHrs.toString().padStart(2, '0')}:${endMins.toString().padStart(2, '0')}`
       }
       
       const allFurnaceHeats = updated.filter(h => h.equipmentId === activeFurnaceTab && h.quantityScheduled !== 0)
       const heatIdxInFurnace = allFurnaceHeats.findIndex(h => h.itemId === updated[index].itemId)
       
       const recalculated = recalculateTimings(allFurnaceHeats, heatIdxInFurnace + 1, activeFurnaceTab)
       updated = updated.map(h => {
          if (h.equipmentId === activeFurnaceTab && h.quantityScheduled !== 0) {
            return recalculated.find(r => r.itemId === h.itemId) || h
          }
          return h
       })
    }
    
    setPlanningHeats(updated)
  }

  const handleRemovePlanningHeat = (index: number) => {
    let updated = [...planningHeats]
    const heat = updated[index]
    if (heat.quantityScheduled !== undefined || heat._id) {
      updated[index] = { ...heat, quantityScheduled: 0, meltWeight: 0 } 
    } else {
      updated.splice(index, 1) 
    }
    
    const allFurnaceHeats = updated.filter(h => h.equipmentId === activeFurnaceTab && h.quantityScheduled !== 0)
    const recalculated = recalculateTimings(allFurnaceHeats, 0, activeFurnaceTab)
    updated = updated.map(h => {
       if (h.equipmentId === activeFurnaceTab && h.quantityScheduled !== 0) {
         return recalculated.find(r => r.itemId === h.itemId) || h
       }
       return h
    })

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
            className="bg-[#4F46E5] hover:bg-[#4F46E5]/90 text-white px-5 py-2.5 rounded-lg font-bold shadow-sm flex items-center gap-2 transition-transform hover:scale-105"
          >
            <Plus weight="bold" className="w-4 h-4" />
            New Charge
          </button>
        </div>
      )}
      <div className="bg-[#F4F6FB] border border-[#E0E7FF] rounded-xl relative flex flex-col p-4 overflow-x-auto">
        <div className="grid grid-cols-7 mb-2 min-w-[800px]">
          {weekDays.map(day => (
            <div key={day} className="py-2 text-center text-xs font-semibold text-[#64748B] uppercase tracking-wider">
              {day}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-3 flex-1 min-w-[800px]">
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
                  "p-2 transition-all duration-300 ease-out flex flex-col min-h-[120px] relative group border rounded-[12px] shadow-[0_1px_3px_rgba(0,0,0,0.02)] hover:-translate-y-[2px] overflow-hidden relative",
                  "bg-[#FFFFFF] border-[#E0E7FF]",
                  !isCurrentMonth && "bg-[#F8FAFC]/50 opacity-70 hover:opacity-100",
                  activeTab === 'planning' && "hover:border-[#4F46E5] hover:shadow-[0_4px_14px_rgba(79,70,229,0.12)] cursor-pointer",
                  activeTab === 'tracking' && (dayHeats.length > 0 ? "hover:border-[#E0E7FF] hover:shadow-md cursor-pointer" : "cursor-default hover:shadow-sm hover:border-[#E0E7FF]")
                )}
              >
                {isToday && <div className="absolute left-0 top-0 bottom-0 w-1 bg-[#4F46E5]" />}
                <div className="flex justify-between items-start mb-2 pl-1">
                  <span className={cn("text-sm font-medium w-7 h-7 flex items-center justify-center rounded-full", isToday ? "bg-[#4F46E5] text-white" : "text-[#64748B]")}>
                    {date.getDate()}
                  </span>
                </div>
                
                <div className="flex-1 space-y-1 pl-1">
                  {activeTab === 'planning' ? (
                    <div className="flex flex-col gap-1 mt-1">
                      {dayHeats.length > 0 && (
                        <div 
                          draggable
                          onDragStart={(e) => { 
                            e.stopPropagation(); 
                            setDraggedHeats(dayHeats);
                          }}
                          className="flex items-center justify-between px-1.5 py-1 rounded-md hover:bg-[#F8FAFC] transition-colors cursor-grab"
                        >
                          <div className="flex items-center gap-1.5">
                            <div className="w-1.5 h-1.5 rounded-full bg-orange-400" />
                            <span className="text-[10.5px] font-medium text-[#64748B]">Planned</span>
                          </div>
                          <span className="text-[10.5px] font-bold text-[#0F172A]">{dayHeats.length}</span>
                        </div>
                      )}
                      {pending > 0 && (
                        <div 
                          draggable
                          onDragStart={(e) => { 
                            e.stopPropagation(); 
                            setDraggedHeats(dayHeats.filter(h => !h.actualQuantity || h.actualQuantity <= 0));
                          }}
                          className="flex items-center justify-between px-1.5 py-1 bg-red-50/50 hover:bg-red-50 rounded-md transition-colors cursor-grab mt-1"
                        >
                          <div className="flex items-center gap-1.5">
                            <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                            <span className="text-[10.5px] font-medium text-red-600">Pending</span>
                          </div>
                          <span className="text-[10.5px] font-bold text-red-600">{pending}</span>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="flex flex-col gap-1 mt-1">
                      {dayHeats.length > 0 && (
                        <div className="flex items-center justify-between px-1.5 py-1 rounded-md hover:bg-[#F8FAFC] transition-colors">
                          <div className="flex items-center gap-1.5">
                            <div className="w-1.5 h-1.5 rounded-full bg-orange-400" />
                            <span className="text-[10.5px] font-medium text-[#64748B]">Planned</span>
                          </div>
                          <span className="text-[10.5px] font-bold text-[#0F172A]">{dayHeats.length}</span>
                        </div>
                      )}
                      {completed > 0 && (
                        <div className="flex items-center justify-between px-1.5 py-1 rounded-md hover:bg-[#F8FAFC] transition-colors mt-1">
                          <div className="flex items-center gap-1.5">
                            <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
                            <span className="text-[10.5px] font-medium text-[#64748B]">Done</span>
                          </div>
                          <span className="text-[10.5px] font-bold text-green-600">{completed}</span>
                        </div>
                      )}
                      {pending > 0 && (
                        <div className="flex items-center justify-between px-1.5 py-1 bg-red-50/50 hover:bg-red-50 rounded-md transition-colors mt-1">
                          <div className="flex items-center gap-1.5">
                            <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                            <span className="text-[10.5px] font-medium text-red-600">Pending</span>
                          </div>
                          <span className="text-[10.5px] font-bold text-red-600">{pending}</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* DAILY HEAT PLANNING MODAL */}
      {selectedDateForPlanning && (
        <div className="fixed inset-0 z-[40] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={() => setSelectedDateForPlanning(null)}>
          <div className="bg-[#FFFFFF] border-t-2 border-[#4F46E5] rounded-[14px] text-[#172554] max-w-5xl w-full flex flex-col shadow-2xl h-[85vh] animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center p-6 border-b border-[#1F2937] shrink-0 bg-[#FFFFFF] rounded-t-[14px]">
              <div>
                <h2 className="text-2xl font-bold font-heading tracking-tight text-[#172554]">Daily Heat Plan</h2>
                <p className="text-[#64748B] font-mono text-sm mt-1">{selectedDateForPlanning}</p>
              </div>
              <button onClick={() => setSelectedDateForPlanning(null)} className="text-[#64748B] hover:text-white transition-colors bg-[#FFFFFF] p-2 rounded-full hover:bg-[#374151]">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            {furnaces.length > 0 && (
              <div className="flex border-b border-[#1F2937] bg-[#FFFFFF] px-6 overflow-x-auto">
                {furnaces.map(f => (
                  <button
                    key={f.id}
                    onClick={() => setActiveFurnaceTab(f.id)}
                    className={cn(
                      "px-6 py-3 font-semibold text-sm transition-colors border-b-2 whitespace-nowrap",
                      activeFurnaceTab === f.id
                        ? "border-b-2 border-[#4F46E5] text-[#4F46E5] bg-[#EEF2FF]"
                        : "border-transparent text-[#64748B] hover:text-[#172554] hover:bg-[#F4F6FB]"
                    )}
                  >
                    {f.name}
                  </button>
                ))}
              </div>
            )}
            
            <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-[#F4F6FB]">
              {planningHeats.filter(h => h.equipmentId === activeFurnaceTab && h.quantityScheduled !== 0).map((heat, filteredIdx) => {
                const idx = planningHeats.findIndex(h => h.itemId === heat.itemId)
                return (
                <div key={heat.itemId || idx} className="bg-[#FFFFFF] border border-[#E0E7FF] rounded-xl overflow-hidden shadow-sm">
                  <div className="flex items-center gap-4 p-4 border-b border-[#E0E7FF] bg-[#FFFFFF]">
                    <div className="w-8 h-8 rounded-full bg-[#4F46E5]/10 text-[#4F46E5] flex items-center justify-center font-bold font-mono border border-[#4F46E5]/20">
                      {filteredIdx + 1}
                    </div>
                    <Input 
                      value={heat.heatNo || ''} 
                      onChange={e => handleUpdatePlanningHeat(idx, 'heatNo', e.target.value)} 
                      className="bg-transparent border-none text-xl font-bold font-heading text-[#172554] w-32 focus-visible:ring-1 focus-visible:ring-[#4F46E5] px-2 h-auto py-1" 
                      placeholder="H001"
                    />
                    <div className="ml-auto flex items-center gap-2">
                      <Button variant="ghost" size="sm" onClick={() => handleRemovePlanningHeat(idx)} className="text-[#64748B] hover:text-red-400 hover:bg-red-500/10">
                        <Trash className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-6 p-6">
                    <div className="space-y-2">
                      <Label className="text-xs font-bold text-[#94A3B8] uppercase tracking-wider">Time Slot</Label>
                      <div className="flex items-center gap-2">
                        <Input 
                          type="time" 
                          value={heat.startTime || '08:00'} 
                          onChange={e => handleUpdatePlanningHeat(idx, 'startTime', e.target.value)} 
                          className="bg-[#FFFFFF] border-[#E0E7FF] text-[#172554] font-mono h-10" 
                        />
                        <span className="text-[#94A3B8] font-bold">—</span>
                        <Input 
                          type="time" 
                          value={heat.endTime || '10:30'} 
                          onChange={e => handleUpdatePlanningHeat(idx, 'endTime', e.target.value)} 
                          className="bg-[#FFFFFF] border-[#E0E7FF] text-[#172554] font-mono h-10" 
                        />
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      <Label className="text-xs font-bold text-[#94A3B8] uppercase tracking-wider">Grade</Label>
                      <Select value={heat.grade || 'FC 200'} onValueChange={v => handleUpdatePlanningHeat(idx, 'grade', v)}>
                        <SelectTrigger className="bg-[#FFFFFF] border-[#E0E7FF] text-[#172554] h-10">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-[#FFFFFF] border-[#E0E7FF]">
                          {ALL_GRADES.map(g => (
                            <SelectItem key={g} value={g} className="text-[#172554] hover:bg-[#374151]">{g}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div className="space-y-2">
                      <Label className="text-xs font-bold text-[#94A3B8] uppercase tracking-wider">Allocated Weight (kg)</Label>
                      <Input 
                        type="number" 
                        readOnly
                        value={heat.meltWeight || heat.quantityScheduled || 0} 
                        className="bg-[#374151] border-[#E0E7FF] text-[#64748B] font-mono h-10 cursor-not-allowed" 
                      />
                    </div>

                    <div className="space-y-2">
                      <Label className="text-xs font-bold text-[#94A3B8] uppercase tracking-wider">Pouring Allocation</Label>
                      <Button
                        variant="outline"
                        onClick={() => setAllocationModalOpen({ idx, grade: heat.grade })}
                        className="w-full bg-[#FFFFFF] border-[#E0E7FF] text-[#172554] hover:bg-[#374151] hover:text-white h-10 justify-between"
                      >
                        <span className="truncate">
                          {heat.allocations?.length > 0 ? `${heat.allocations.length} Products Allocated` : 'Select Moulds...'}
                        </span>
                        <ListPlus className="w-4 h-4 text-[#64748B]" />
                      </Button>
                    </div>
                  </div>
                </div>
                )
              })}
              
              {planningHeats.filter(h => h.equipmentId === activeFurnaceTab && h.quantityScheduled !== 0).length === 0 && (
                <div className="text-center text-[#94A3B8] py-20 bg-[#FFFFFF] border border-[#E0E7FF] rounded-xl border-dashed">
                  No heats planned for this furnace on {selectedDateForPlanning}.
                </div>
              )}

              <Button 
                variant="outline" 
                onClick={handleAddPlanningHeat} 
                className="w-full border-dashed border-[#4F46E5]/50 text-[#4F46E5] hover:bg-[#4F46E5]/10 hover:text-[#E56020] hover:border-[#4F46E5] h-14 bg-transparent mt-4"
              >
                <Plus className="w-5 h-5 mr-2" weight="bold" />
                Add Heat Slot
              </Button>
            </div>
            
            <div className="p-6 border-t border-[#1F2937] bg-[#FFFFFF] rounded-b-[14px] flex justify-between items-center shrink-0">
              <div className="text-[#94A3B8] text-sm">
                Total Planned Weight: <span className="text-[#172554] font-mono font-bold ml-1">{planningHeats.filter(h => h.quantityScheduled !== 0).reduce((acc, curr) => acc + (curr.meltWeight || curr.quantityScheduled || 0), 0)} kg</span>
              </div>
              <div className="flex gap-3">
                <Button variant="outline" onClick={() => setSelectedDateForPlanning(null)} className="border-[#E0E7FF] text-[#64748B] hover:text-white bg-transparent">CANCEL</Button>
                <Button onClick={handleSavePlanning} className="bg-[#4F46E5] hover:bg-[#4F46E5]/90 text-white uppercase font-bold tracking-wider px-8 shadow-lg shadow-[#4F46E5]/20">SAVE DAY PLAN</Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ALLOCATION SUB-MODAL */}
      {allocationModalOpen && (
        <PouringAllocationModal
          furnace={furnaces.find(f => f.id === activeFurnaceTab)}
          heat={planningHeats[allocationModalOpen.idx]}
          backlogs={mouldBacklogs.filter(b => b.grade === allocationModalOpen.grade)}
          onSave={(allocations: any[], totalWeight: number) => {
            let updated = [...planningHeats]
            updated[allocationModalOpen.idx].allocations = allocations
            updated[allocationModalOpen.idx].meltWeight = totalWeight
            setPlanningHeats(updated)
            setAllocationModalOpen(null)
          }}
          onClose={() => setAllocationModalOpen(null)}
        />
      )}

      {/* TRACKING DRAWER */}
      {selectedDate && activeTab === 'tracking' && (
        <div className="fixed inset-0 z-[40] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={() => setSelectedDate(null)}>
          <div className="bg-[#FFFFFF] border-t-2 border-[#4F46E5] rounded-[14px] text-[#172554] max-w-4xl w-full flex flex-col shadow-2xl max-h-[85vh] animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
            <div className="p-6 border-b border-[#1F2937] bg-[#FFFFFF] rounded-t-[14px] flex justify-between items-start shrink-0">
              <div>
                <h2 className="text-xl font-bold text-[#172554] font-mono tracking-tight">{selectedDate}</h2>
                <Badge variant="outline" className="mt-2 border-[#4F46E5]/30 text-[#4F46E5] bg-[#4F46E5]/10 uppercase text-[10px] font-bold tracking-wider">
                  MELT TRACKING
                </Badge>
              </div>
              <button onClick={() => setSelectedDate(null)} className="text-[#64748B] hover:text-white transition-colors bg-[#FFFFFF] p-2 rounded-full hover:bg-[#374151]">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-[#F4F6FB] p-6 border-b border-[#E0E7FF] shrink-0">
              <div className="flex justify-between items-center text-sm font-medium mb-3">
                <div className="text-[#172554]">Planned: {drawerPlanned}</div>
                <div className="text-green-400">Done: {drawerCompleted}</div>
                <div className="text-red-400">Pending: {drawerPending}</div>
              </div>
              <div className="flex justify-between items-center mb-1">
                <span className="text-xs text-[#64748B] uppercase font-bold tracking-wider">Coverage</span>
                <span className="text-xs text-[#172554] font-bold font-mono">{drawerCoverage.toFixed(0)}%</span>
              </div>
              <div className="w-full bg-[#FFFFFF] rounded-full h-2">
                <div className={cn("h-2 rounded-full", drawerCoverage === 100 ? "bg-green-500" : "bg-amber-500")} style={{ width: `${drawerCoverage}%` }} />
              </div>
            </div>
            
            <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-[#F4F6FB]">
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
                  <details key={idx} className="group bg-[#FFFFFF] border border-[#E0E7FF] rounded-lg overflow-hidden" open={idx === 0}>
                    <summary className="p-3 cursor-pointer select-none bg-[#FFFFFF] hover:bg-[#374151] transition-colors flex items-center justify-between outline-none">
                      <div className="flex items-center gap-3">
                        <span className="font-bold text-[#172554] font-mono">{heat.heatNo || `H00${idx+1}`}</span>
                        <Badge variant="outline" className="border-[#E0E7FF] text-[#64748B] bg-[#FFFFFF] text-[10px] uppercase">
                          {heat.grade}
                        </Badge>
                      </div>
                      <div className="text-[#64748B] text-sm font-mono">{weight}kg</div>
                    </summary>
                    <div className="p-4 border-t border-[#E0E7FF] bg-[#FFFFFF] space-y-4">
                      <div className="grid grid-cols-[80px_1fr_1fr_1fr] gap-2 items-center text-xs">
                        <div className="font-semibold text-[#6B7280] uppercase">Plan</div>
                        <div className="text-[#64748B] font-mono text-center">Pig {pPig.toFixed(1)}</div>
                        <div className="text-[#64748B] font-mono text-center">Scrap {pScrap.toFixed(1)}</div>
                        <div className="text-[#64748B] font-mono text-center">FeMn {pFeMn.toFixed(1)}</div>
                      </div>
                      
                      <div className="grid grid-cols-[80px_1fr_1fr_1fr] gap-2 items-center text-xs">
                        <div className="font-semibold text-[#172554] uppercase">Actual</div>
                        <Input value={form.pigIron} onChange={e => handleActualChange(heatId, 'pigIron', e.target.value)} className="h-7 text-center font-mono bg-[#FFFFFF] border-[#E0E7FF] text-[#172554] px-1" placeholder="0" />
                        <Input value={form.scrap} onChange={e => handleActualChange(heatId, 'scrap', e.target.value)} className="h-7 text-center font-mono bg-[#FFFFFF] border-[#E0E7FF] text-[#172554] px-1" placeholder="0" />
                        <Input value={form.feMn} onChange={e => handleActualChange(heatId, 'feMn', e.target.value)} className="h-7 text-center font-mono bg-[#FFFFFF] border-[#E0E7FF] text-[#172554] px-1" placeholder="0" />
                      </div>

                      <div className="grid grid-cols-[80px_1fr_1fr_1fr] gap-2 items-center text-xs">
                        <div className="font-semibold text-[#6B7280] uppercase">Var</div>
                        <div className="font-mono text-center">{formatVar(varPig)}</div>
                        <div className="font-mono text-center">{formatVar(varScrap)}</div>
                        <div className="font-mono text-center">{formatVar(varFeMn)}</div>
                      </div>

                      <div className="h-px w-full bg-[#374151] my-2" />
                      
                      <div className="flex items-center justify-between">
                        <Label className="text-xs text-[#64748B] uppercase font-bold">Heats Completed</Label>
                        <div className="flex items-center gap-2">
                          <Input 
                            type="number" 
                            value={form.meltWeight} 
                            onChange={e => handleActualChange(heatId, 'meltWeight', e.target.value)} 
                            className="w-20 h-8 text-center font-mono font-bold bg-[#FFFFFF] border-[#E0E7FF] text-[#172554]" 
                          />
                          <span className="text-[#6B7280] text-sm">/ {weight}kg</span>
                        </div>
                      </div>
                    </div>
                  </details>
                )
              })}
              {dayHeatsForDrawer.length === 0 && (
                <div className="text-center text-[#94A3B8] py-20 bg-[#FFFFFF] border border-[#E0E7FF] rounded-xl border-dashed">
                  No heats scheduled for this date.
                </div>
              )}
            </div>

            <div className="p-6 border-t border-[#1F2937] bg-[#FFFFFF] rounded-b-[14px] flex justify-end gap-3 shrink-0">
              <Button variant="outline" onClick={() => setSelectedDate(null)} className="border-[#E0E7FF] text-[#64748B] hover:text-white bg-transparent">CANCEL</Button>
              <Button onClick={handleSaveActuals} className="bg-[#4F46E5] hover:bg-[#4F46E5]/90 text-white uppercase font-bold tracking-wider px-8 shadow-lg shadow-[#4F46E5]/20">SAVE ACTUALS</Button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}

function PouringAllocationModal({ furnace, heat, backlogs, onSave, onClose }: any) {
  const [allocs, setAllocs] = useState<Record<string, number>>({})

  useEffect(() => {
    const init: Record<string, number> = {}
    heat.allocations?.forEach((a: any) => {
      init[a.itemId] = a.moulds
    })
    setAllocs(init)
  }, [heat])

  const furnaceCapacity = furnace?.weightCapacity || 500
  
  const totalAllocatedWeight = Object.entries(allocs).reduce((acc, [itemId, qty]) => {
    const b = backlogs.find((x: any) => x.itemId === itemId)
    return acc + (qty * (b?.boxWeight || 0))
  }, 0)

  const handleAllocationChange = (itemId: string, value: string) => {
    const qty = parseInt(value, 10) || 0
    setAllocs(prev => ({
      ...prev,
      [itemId]: qty
    }))
  }

  const handleSave = () => {
    if (totalAllocatedWeight > furnaceCapacity) {
      alert(`Cannot exceed furnace capacity of ${furnaceCapacity} kg!`)
      return
    }
    
    const allocationsToSave = Object.entries(allocs)
      .filter(([_, qty]) => qty > 0)
      .map(([itemId, qty]) => {
        const b = backlogs.find((x: any) => x.itemId === itemId)
        return {
          itemId,
          moulds: qty,
          boxWeight: b?.boxWeight || 0
        }
      })
      
    onSave(allocationsToSave, totalAllocatedWeight)
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="bg-[#FFFFFF] border border-[#E0E7FF] rounded-[14px] text-[#172554] max-w-3xl w-full flex flex-col shadow-2xl animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-center p-5 border-b border-[#E0E7FF]">
          <div>
            <h3 className="text-xl font-bold font-heading">Pouring Allocation</h3>
            <p className="text-[#64748B] text-sm mt-1 font-mono">{furnace?.name} ({furnaceCapacity}kg) - Grade {heat.grade}</p>
          </div>
          <button onClick={onClose} className="text-[#64748B] hover:text-[#172554] transition-colors bg-[#F3F4F6] p-2 rounded-full hover:bg-[#E5E7EB]">
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <div className="flex-1 overflow-y-auto p-5 space-y-4 max-h-[60vh]">
          {backlogs.length === 0 ? (
            <div className="text-center text-[#9CA3AF] py-10 italic">
              No produced moulds found for Grade {heat.grade}.
            </div>
          ) : (
            <div className="space-y-3">
              {backlogs.map((b: any) => {
                const maxPossible = b.boxWeight > 0 ? Math.floor(furnaceCapacity / b.boxWeight) : 0
                return (
                  <div key={b.itemId} className="bg-[#1F2937] border border-[#374151] rounded-lg p-4 flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-[#F3F4F6]">{b.productName}</span>
                        <Badge variant="outline" className="border-[#374151] text-[#9CA3AF] bg-[#111827] text-[10px]">
                          {b.orderNo}
                        </Badge>
                      </div>
                      <div className="text-[#9CA3AF] text-xs mt-2 flex gap-4">
                        <span>Produced: <strong className="text-white">{b.producedMoulds}</strong></span>
                        <span>Available: <strong className="text-green-400">{b.availableMoulds}</strong></span>
                        <span>Box Wt: <strong className="text-white font-mono">{b.boxWeight}kg</strong></span>
                      </div>
                      <div className="text-[#6B7280] text-[10px] mt-1 font-mono uppercase tracking-wider">
                        Max Possible Moulds for Furnace: {maxPossible}
                      </div>
                    </div>
                    
                    <div className="w-24">
                      <Label className="text-[10px] text-[#9CA3AF] uppercase mb-1 block">Allocate</Label>
                      <Input
                        type="number"
                        min="0"
                        max={Math.min(b.availableMoulds, maxPossible)}
                        value={allocs[b.itemId] || ''}
                        onChange={e => handleAllocationChange(b.itemId, e.target.value)}
                        className="bg-[#111827] border-[#4B5563] text-white font-mono h-9 text-center"
                        placeholder="0"
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
        
        <div className="p-5 border-t border-[#1F2937] bg-[#111827] rounded-b-[14px] flex justify-between items-center">
          <div className="text-sm text-[#9CA3AF]">
            Allocated Weight:{' '}
            <span className={cn(
              "font-mono font-bold ml-1 text-lg",
              totalAllocatedWeight > furnaceCapacity ? "text-red-500" : "text-green-400"
            )}>
              {totalAllocatedWeight} / {furnaceCapacity} kg
            </span>
          </div>
          <div className="flex gap-3">
            <Button variant="outline" onClick={onClose} className="border-[#374151] text-[#9CA3AF] hover:text-white bg-transparent">Cancel</Button>
            <Button 
              onClick={handleSave} 
              disabled={totalAllocatedWeight > furnaceCapacity}
              className="bg-[#4F46E5] hover:bg-[#4F46E5]/90 text-white font-bold"
            >
              Apply Allocation
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
