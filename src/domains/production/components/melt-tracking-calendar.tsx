'use client'

import { useState, useMemo } from 'react'
import { X, CheckCircle, WarningCircle } from '@phosphor-icons/react'
import { Button } from '@/shared/ui/button'
import { Input } from '@/shared/ui/input'
import { Label } from '@/shared/ui/label'
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

export function MeltTrackingCalendar({ dailyPlans, onSaveDayPlan }: any) {
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [actualsForms, setActualsForms] = useState<Record<string, any>>({})

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

  // Summary logic
  const { totalPlanned, totalCompleted, totalPending, coverage } = useMemo(() => {
    let planned = 0
    let completed = 0
    let pending = 0
    dailyPlans.forEach((p: any) => {
      if (p.stage === 'Melt') {
        planned++
        if (p.actualQuantity !== undefined && p.actualQuantity > 0) completed++
        else pending++
      }
    })
    return {
      totalPlanned: planned,
      totalCompleted: completed,
      totalPending: pending,
      coverage: planned > 0 ? (completed / planned) * 100 : 0
    }
  }, [dailyPlans])

  // Open Drawer and initialize state
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
      [heatId]: {
        ...prev[heatId],
        [field]: value
      }
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

  return (
    <div className="space-y-6 relative overflow-hidden">
      {/* SUMMARY STATS */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-[#0C1221] border border-[#243050] p-4 rounded-xl flex flex-col items-center justify-center relative overflow-hidden">
          <div className="absolute top-0 right-0 w-16 h-16 bg-[#4285F4]/10 rounded-full blur-xl pointer-events-none -mr-4 -mt-4" />
          <p className="text-xs text-[#8B9FC4] uppercase tracking-wider mb-1">Total Planned Heats</p>
          <p className="text-2xl font-bold font-mono text-[#EEF3FF]">{totalPlanned}</p>
        </div>
        <div className="bg-[#0C1221] border border-[#243050] p-4 rounded-xl flex flex-col items-center justify-center relative overflow-hidden">
          <div className="absolute top-0 right-0 w-16 h-16 bg-green-500/10 rounded-full blur-xl pointer-events-none -mr-4 -mt-4" />
          <p className="text-xs text-[#8B9FC4] uppercase tracking-wider mb-1">Total Completed</p>
          <p className="text-2xl font-bold font-mono text-green-400">{totalCompleted}</p>
        </div>
        <div className="bg-[#0C1221] border border-[#243050] p-4 rounded-xl flex flex-col items-center justify-center relative overflow-hidden">
          <div className="absolute top-0 right-0 w-16 h-16 bg-red-500/10 rounded-full blur-xl pointer-events-none -mr-4 -mt-4" />
          <p className="text-xs text-[#8B9FC4] uppercase tracking-wider mb-1">Total Pending</p>
          <p className="text-2xl font-bold font-mono text-red-500">{totalPending}</p>
        </div>
        <div className="bg-[#0C1221] border border-[#243050] p-4 rounded-xl flex flex-col justify-center relative overflow-hidden">
          <div className={cn("absolute top-0 right-0 w-16 h-16 rounded-full blur-xl pointer-events-none -mr-4 -mt-4", coverage === 100 ? "bg-green-500/10" : "bg-amber-500/10")} />
          <div className="flex justify-between mb-2">
            <p className="text-xs text-[#8B9FC4] uppercase tracking-wider">Coverage %</p>
            <p className="text-xs font-bold font-mono text-[#EEF3FF]">{coverage.toFixed(0)}%</p>
          </div>
          <div className="w-full bg-[#1A263D] rounded-full h-2">
            <div className={cn("h-2 rounded-full", coverage === 100 ? "bg-green-500" : "bg-amber-500")} style={{ width: `${coverage}%` }} />
          </div>
        </div>
      </div>

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
            let completed = 0
            let pending = 0
            dayHeats.forEach(h => {
              if (h.actualQuantity !== undefined && h.actualQuantity > 0) completed++
              else pending++
            })

            return (
              <div 
                key={dateStr}
                onClick={() => { if (dayHeats.length > 0) handleOpenDrawer(dateStr) }}
                className={cn(
                  "bg-[#050810] p-2 hover:bg-[#0C1221] transition-colors flex flex-col min-h-[120px]",
                  !isCurrentMonth && "opacity-50",
                  dayHeats.length > 0 && "cursor-pointer"
                )}
              >
                <div className="flex justify-between items-start mb-2">
                  <span className={cn(
                    "text-sm font-medium w-7 h-7 flex items-center justify-center rounded-full",
                    isToday ? "bg-[#D4521A] text-white" : "text-[#8B9FC4]"
                  )}>
                    {date.getDate()}
                  </span>
                </div>
                
                <div className="flex-1 space-y-1">
                  {dayHeats.length > 0 && (
                    <div className="px-2 py-1 text-[10px] font-bold uppercase rounded-md bg-[#D4521A]/10 text-[#D4521A] border border-[#D4521A]/20 truncate">
                      HEATS {dayHeats.length}
                    </div>
                  )}
                  {completed > 0 && (
                    <div className="px-2 py-1 text-[10px] font-bold uppercase rounded-md bg-green-500/10 text-green-500 border border-green-500/20 truncate">
                      DONE {completed}
                    </div>
                  )}
                  {pending > 0 && (
                    <div className="px-2 py-1 text-[10px] font-bold uppercase rounded-md bg-red-500/10 text-red-500 border border-red-500/20 truncate">
                      PENDING {pending}
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* RIGHT SIDE DRAWER */}
      {selectedDate && (
        <>
          <div className="fixed inset-0 bg-black/60 z-40 backdrop-blur-sm" onClick={() => setSelectedDate(null)} />
          <div className="fixed right-0 top-0 bottom-0 w-[420px] bg-[#050810] border-l border-[#243050] z-50 flex flex-col shadow-2xl animate-in slide-in-from-right duration-200">
            <div className="p-6 border-b border-[#243050] bg-[#0C1221] flex justify-between items-center shrink-0">
              <div>
                <Badge variant="outline" className="mb-2 border-[#D4521A]/30 text-[#D4521A] bg-[#D4521A]/10 uppercase text-[10px] font-bold tracking-wider">
                  Melt Tracking
                </Badge>
                <h2 className="text-xl font-bold text-[#EEF3FF] font-mono tracking-tight">{selectedDate}</h2>
              </div>
              <button onClick={() => setSelectedDate(null)} className="text-[#8B9FC4] hover:text-[#EEF3FF] transition-colors p-2 rounded-lg hover:bg-[#1A263D]">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
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
                
                const varPig = aPig - pPig
                const varScrap = aScrap - pScrap
                const varFeMn = aFeMn - pFeMn
                const varCarb = aCarb - pCarb
                
                const actualQty = form.meltWeight ? Number(form.meltWeight) : 0
                const isShort = actualQty < weight

                return (
                  <div key={idx} className="bg-[#0C1221] border border-[#243050] rounded-xl overflow-hidden shadow-sm">
                    <div className="p-4 bg-[#1A263D]/50 border-b border-[#243050] flex justify-between items-center">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-[#EEF3FF] font-bold">{heat.heatNo || `H---`}</span>
                        <Badge variant="outline" className="border-[#4285F4]/30 text-[#4285F4] bg-[#4285F4]/10">
                          {heat.grade || 'FC 200'}
                        </Badge>
                      </div>
                      <span className="text-[#8B9FC4] font-mono text-sm">{weight} kg</span>
                    </div>

                    <div className="p-4 space-y-4">
                      {/* PLANNED VS ACTUAL INPUTS */}
                      <div className="grid grid-cols-[1fr_80px_80px_80px] gap-2 items-center mb-2">
                        <div className="text-xs uppercase font-bold tracking-wider text-[#5A6E90]">Material</div>
                        <div className="text-xs uppercase font-bold tracking-wider text-[#5A6E90] text-right">Plan</div>
                        <div className="text-xs uppercase font-bold tracking-wider text-[#5A6E90] text-center">Actual</div>
                        <div className="text-xs uppercase font-bold tracking-wider text-[#5A6E90] text-right">Var</div>
                      </div>

                      {[
                        { label: 'Pig Iron', plan: pPig, val: form.pigIron, field: 'pigIron', var: varPig },
                        { label: 'Scrap', plan: pScrap, val: form.scrap, field: 'scrap', var: varScrap },
                        { label: 'FeMn', plan: pFeMn, val: form.feMn, field: 'feMn', var: varFeMn },
                        { label: 'Carburizer', plan: pCarb, val: form.carburizer, field: 'carburizer', var: varCarb },
                      ].map((row, i) => (
                        <div key={i} className="grid grid-cols-[1fr_80px_80px_80px] gap-2 items-center">
                          <Label className="text-sm text-[#8B9FC4]">{row.label}</Label>
                          <span className="text-sm font-mono text-[#EEF3FF] text-right">{row.plan.toFixed(1)}</span>
                          <Input 
                            type="number"
                            value={row.val}
                            onChange={(e) => handleActualChange(heatId, row.field, e.target.value)}
                            className="h-8 px-2 text-right bg-[#050810] border-[#243050] text-[#EEF3FF] font-mono text-sm [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                          />
                          <span className={cn(
                            "text-sm font-mono text-right",
                            row.var > 0 ? "text-green-400" : row.var < 0 ? "text-red-400" : "text-[#5A6E90]"
                          )}>
                            {row.var > 0 ? '+' : ''}{row.var !== 0 ? row.var.toFixed(1) : '-'}
                          </span>
                        </div>
                      ))}

                      <div className="border-t border-[#243050] pt-4 mt-2">
                         <div className="grid grid-cols-[1fr_80px_80px_80px] gap-2 items-center">
                          <Label className="text-sm font-bold text-[#EEF3FF]">Melt Weight</Label>
                          <span className="text-sm font-mono font-bold text-[#EEF3FF] text-right">{weight.toFixed(1)}</span>
                          <Input 
                            type="number"
                            value={form.meltWeight}
                            onChange={(e) => handleActualChange(heatId, 'meltWeight', e.target.value)}
                            className="h-8 px-2 text-right bg-[#D4521A]/10 border-[#D4521A]/30 text-[#D4521A] font-mono font-bold text-sm [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                          />
                          <span className={cn(
                            "text-sm font-mono text-right font-bold",
                            (actualQty - weight) > 0 ? "text-green-400" : (actualQty - weight) < 0 ? "text-red-400" : "text-[#5A6E90]"
                          )}>
                            {(actualQty - weight) > 0 ? '+' : ''}{(actualQty - weight) !== 0 ? (actualQty - weight).toFixed(1) : '-'}
                          </span>
                        </div>
                      </div>

                      {/* Status Row */}
                      {actualQty > 0 && (
                        <div className="mt-4 p-3 rounded-lg bg-[#050810] border border-[#243050] flex items-center justify-between">
                          <div className="flex items-center gap-2 text-sm">
                            {isShort ? <WarningCircle weight="fill" className="text-red-500 w-5 h-5" /> : <CheckCircle weight="fill" className="text-green-500 w-5 h-5" />}
                            <span className={isShort ? "text-red-400" : "text-green-400"}>
                              {isShort ? 'Shortfall (Will push to next day)' : 'Target Met'}
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>

            <div className="p-6 border-t border-[#243050] bg-[#0C1221] flex justify-end gap-3 shrink-0">
              <Button variant="ghost" onClick={() => setSelectedDate(null)} className="text-[#8B9FC4] hover:text-[#EEF3FF] hover:bg-[#1A263D]">
                Cancel
              </Button>
              <Button onClick={handleSaveActuals} className="bg-[#D4521A] hover:bg-[#E56020] text-white">
                Save Actuals
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
