'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { Card } from '@/shared/ui/card'
import { Input } from '@/shared/ui/input'
import { Button } from '@/shared/ui/button'
import { Badge } from '@/shared/ui/badge'
import { cn } from '@/shared/lib/utils'
import { CheckCircle, ClockCounterClockwise, ArrowRight, MagnifyingGlass, Funnel, CalendarCheck } from '@phosphor-icons/react'
import { motion, AnimatePresence } from 'framer-motion'
import { CloseDayModal } from '@/domains/production/components/close-day-modal'
import { OrderTimelineDrawer } from '@/domains/production/components/order-timeline-drawer'

export interface IStageData {
  planned: number
  completed: number
  pending: number
  variance: number
  unit: string
  rejected?: number
  rework?: number
  operator?: string
  remarks?: string
  invoiceNumber?: string
  vehicleNumber?: string
  driverName?: string
}

export interface Schedule {
  id: string
  orderId: string
  date: string
  shift: string
  priority: string
  remarks: string
  status: string
  customerOrderNo: string
  customer: string
  cart: any[]
  stages: {
    core: IStageData
    melting: IStageData
    moulding: IStageData
    pouring: IStageData
    knockout: IStageData
    shotBlasting: IStageData
    grinding: IStageData
    inspection: IStageData
    readyForDispatch: IStageData
  }
}

type StageKey = keyof Schedule['stages']

const STAGES: { key: StageKey; label: string }[] = [
  { key: 'core', label: 'Core' },
  { key: 'moulding', label: 'Moulding' },
  { key: 'melting', label: 'Melting' },
  { key: 'pouring', label: 'Pouring' },
  { key: 'knockout', label: 'Knockout' },
  { key: 'shotBlasting', label: 'Shot Blasting' },
  { key: 'grinding', label: 'Grinding' },
  { key: 'inspection', label: 'Inspection' },
  { key: 'readyForDispatch', label: 'Ready for Dispatch' }
]

export default function ProductionTrackingPage() {
  const [activeStage, setActiveStage] = useState<StageKey>('core')
  const [schedules, setSchedules] = useState<Schedule[]>([])
  const [loading, setLoading] = useState(true)
  
  // Filters
  const [search, setSearch] = useState('')
  const [dateFilter, setDateFilter] = useState(() => new Date().toISOString().split('T')[0])
  
  // Modals
  const [isCloseDayOpen, setIsCloseDayOpen] = useState(false)
  const [timelineOrder, setTimelineOrder] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    try {
      setLoading(true)
      const res = await fetch(`/api/schedules?date=${dateFilter}`)
      if (res.ok) {
        setSchedules(await res.json())
      }
    } catch (err) {
      console.error('Failed to fetch schedules:', err)
    } finally {
      setLoading(false)
    }
  }, [dateFilter])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const handleStageUpdate = (scheduleId: string, field: keyof IStageData, value: string | number) => {
    setSchedules(prevSchedules => {
      return prevSchedules.map(sched => {
        if (sched.id !== scheduleId) return sched
        
        const updated = JSON.parse(JSON.stringify(sched)) as Schedule
        const stageData = updated.stages[activeStage]
        
        // Update the current stage field
        if (field === 'operator' || field === 'remarks' || field === 'invoiceNumber' || field === 'vehicleNumber') {
           (stageData as any)[field] = value as string
        } else {
           const numVal = typeof value === 'string' ? parseInt(value, 10) || 0 : value
           ;(stageData as any)[field] = numVal
           
           // Auto-propagate 'completed' backward to earlier stages if they are currently 0
           if (field === 'completed' && stageData.planned > 0) {
              const ratio = numVal / stageData.planned
              const stageOrder = [
                'core', 'melting', 'moulding', 'pouring', 'knockout', 
                'shotBlasting', 'grinding', 'inspection', 'readyForDispatch'
              ]
              const currentIndex = stageOrder.indexOf(activeStage)
              
              if (currentIndex > 0) {
                 for (let i = 0; i < currentIndex; i++) {
                    const pStage = (updated.stages as any)[stageOrder[i]]
                    if (pStage && pStage.completed === 0 && pStage.planned > 0) {
                       pStage.completed = Math.ceil(pStage.planned * ratio)
                       pStage.pending = Math.max(0, pStage.planned - pStage.completed)
                       pStage.variance = pStage.completed - pStage.planned
                    }
                 }
              }
           }
           
           // MOULD TO PIECE CONVERSION
           // If we just updated pouring (moulds), we need to set knockout (pieces)
           if (field === 'completed' && activeStage === 'pouring') {
              const cavity = updated.cart && updated.cart.length > 0 ? (updated.cart[0].cavity || 1) : 1
              const totalPiecesProduced = numVal * cavity
              
              const knockoutStage = updated.stages.knockout
              if (knockoutStage && knockoutStage.planned === 0 && knockoutStage.completed === 0) {
                 // Push it to knockout as planned pieces received
                 knockoutStage.planned = totalPiecesProduced
                 knockoutStage.pending = totalPiecesProduced
                 knockoutStage.variance = -totalPiecesProduced
              }
           }
        }
        
        // Recalculate pending and variance
        stageData.pending = Math.max(0, stageData.planned - (stageData.completed || 0))
        stageData.variance = (stageData.completed || 0) - stageData.planned
        
        return updated
      })
    })
  }

  // Quick save to DB
  const handleSaveProgress = async () => {
    try {
      await fetch('/api/schedules', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(schedules)
      })
    } catch (err) {
      console.error('Failed to save progress:', err)
    }
  }

  const filteredSchedules = useMemo(() => {
    if (!search) return schedules
    const s = search.toLowerCase()
    return schedules.filter(sched => 
      sched.customerOrderNo.toLowerCase().includes(s) || 
      sched.customer.toLowerCase().includes(s)
    )
  }, [schedules, search])

  // KPIs
  const totalMeltingPlanned = schedules.reduce((sum, s) => sum + s.stages.melting.planned, 0)
  const totalMeltingCompleted = schedules.reduce((sum, s) => sum + s.stages.melting.completed, 0)
  const meltingUtil = totalMeltingPlanned ? Math.round((totalMeltingCompleted / totalMeltingPlanned) * 100) : 0
  
  const totalMouldingPlanned = schedules.reduce((sum, s) => sum + s.stages.moulding.planned, 0)
  const totalMouldingCompleted = schedules.reduce((sum, s) => sum + s.stages.moulding.completed, 0)
  const mouldingUtil = totalMouldingPlanned ? Math.round((totalMouldingCompleted / totalMouldingPlanned) * 100) : 0

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-[#EEF3FF] font-heading tracking-tight">Production Tracking</h1>
          <p className="text-[#8B9FC4] mt-1 text-sm">Monitor daily execution, actuals, and variances</p>
        </div>
        <div className="flex items-center gap-3">
          <Input 
            type="date" 
            value={dateFilter}
            onChange={e => setDateFilter(e.target.value)}
            className="w-40 bg-[#0C1221] border-[#243050] text-[#EEF3FF]"
          />
          <Button variant="outline" onClick={handleSaveProgress} className="border-[#243050] text-[#8B9FC4] hover:text-[#EEF3FF] hover:bg-[#1A263D]">
            Save Progress
          </Button>
          <Button onClick={() => setIsCloseDayOpen(true)} disabled={schedules.length === 0} className="bg-[#D4521A] hover:bg-[#E56020] text-white">
            <CalendarCheck className="w-4 h-4 mr-2" />
            Close Day
          </Button>
        </div>
      </div>

      {/* KPI Dashboard Strip */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
         <Card className="bg-[#0C1221] border-[#243050] p-4 flex flex-row items-center justify-between">
            <div>
               <p className="text-[#8B9FC4] text-xs font-semibold uppercase tracking-wider mb-1">Furnace Utilization</p>
               <h3 className="text-2xl font-bold text-[#EEF3FF]">{meltingUtil}%</h3>
            </div>
            <div className="text-right">
               <p className="text-[#5A6E90] text-sm">Completed: {totalMeltingCompleted}</p>
               <p className="text-[#5A6E90] text-sm">Planned: {totalMeltingPlanned}</p>
            </div>
         </Card>
         <Card className="bg-[#0C1221] border-[#243050] p-4 flex flex-row items-center justify-between">
            <div>
               <p className="text-[#8B9FC4] text-xs font-semibold uppercase tracking-wider mb-1">Moulding Line Utilization</p>
               <h3 className="text-2xl font-bold text-[#EEF3FF]">{mouldingUtil}%</h3>
            </div>
            <div className="text-right">
               <p className="text-[#5A6E90] text-sm">Completed: {totalMouldingCompleted}</p>
               <p className="text-[#5A6E90] text-sm">Planned: {totalMouldingPlanned}</p>
            </div>
         </Card>
         <Card className="bg-[#0C1221] border-[#243050] p-4 flex flex-row items-center justify-between">
            <div>
               <p className="text-[#8B9FC4] text-xs font-semibold uppercase tracking-wider mb-1">Active Scheduled Jobs</p>
               <h3 className="text-2xl font-bold text-[#EEF3FF]">{schedules.length}</h3>
            </div>
         </Card>
      </div>

      {/* Process Navigation */}
      <div className="flex items-center gap-1 overflow-x-auto pb-2 scrollbar-hide">
        {STAGES.map((stage, idx) => (
          <div key={stage.key} className="flex items-center shrink-0">
            <button
              onClick={() => setActiveStage(stage.key)}
              className={cn(
                "px-4 py-2 rounded-lg font-semibold text-sm transition-all duration-300 relative overflow-hidden",
                activeStage === stage.key
                  ? "text-[#EEF3FF] bg-[#1A263D] shadow-[inset_0_1px_0_rgba(255,255,255,0.1)] border border-[#243050]"
                  : "text-[#5A6E90] hover:text-[#C4D2EE] hover:bg-[#0C1221] border border-transparent"
              )}
            >
              <div className="flex items-center gap-2 relative z-10">
                {activeStage === stage.key ? (
                  <CheckCircle weight="fill" className="w-4 h-4 text-[#D4521A]" />
                ) : (
                  <ClockCounterClockwise weight="bold" className="w-4 h-4 opacity-50" />
                )}
                {stage.label}
              </div>
            </button>
            
            {idx < STAGES.length - 1 && (
              <ArrowRight weight="bold" className="w-3 h-3 text-[#243050] mx-1" />
            )}
          </div>
        ))}
      </div>

      {/* Search Bar */}
      <div className="relative">
         <MagnifyingGlass className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#5A6E90]" />
         <Input 
            type="text" 
            placeholder="Search by Order No or Customer..." 
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9 bg-[#0C1221] border-[#243050] text-[#EEF3FF]"
         />
      </div>

      {/* Main Table */}
      <div className="bg-[#0C1221] border border-[#243050] rounded-xl overflow-hidden mt-6">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-[#1A263D] border-b border-[#243050]">
              <th className="px-6 py-4 text-xs font-semibold text-[#8B9FC4] uppercase tracking-wider">Order Info</th>
              <th className="px-6 py-4 text-xs font-semibold text-[#8B9FC4] uppercase tracking-wider text-right">Expected/Planned</th>
              
              {activeStage === 'readyForDispatch' ? (
                <>
                  <th className="px-6 py-4 text-xs font-semibold text-[#8B9FC4] uppercase tracking-wider text-right">Dispatch Qty</th>
                  <th className="px-6 py-4 text-xs font-semibold text-[#8B9FC4] uppercase tracking-wider">Logistics (Inv / Veh)</th>
                </>
              ) : activeStage === 'grinding' || activeStage === 'inspection' ? (
                <>
                  <th className="px-6 py-4 text-xs font-semibold text-[#8B9FC4] uppercase tracking-wider text-right">Good/Accepted</th>
                  <th className="px-6 py-4 text-xs font-semibold text-[#8B9FC4] uppercase tracking-wider text-right">Rework</th>
                  <th className="px-6 py-4 text-xs font-semibold text-[#8B9FC4] uppercase tracking-wider text-right">Rejected</th>
                </>
              ) : activeStage === 'knockout' ? (
                <>
                  <th className="px-6 py-4 text-xs font-semibold text-[#8B9FC4] uppercase tracking-wider text-right">Completed</th>
                  <th className="px-6 py-4 text-xs font-semibold text-[#8B9FC4] uppercase tracking-wider text-right">Damaged (Rej)</th>
                </>
              ) : (
                <th className="px-6 py-4 text-xs font-semibold text-[#8B9FC4] uppercase tracking-wider text-right">Actual Completed</th>
              )}
              
              <th className="px-6 py-4 text-xs font-semibold text-[#8B9FC4] uppercase tracking-wider text-right">Pending</th>
              <th className="px-6 py-4 text-xs font-semibold text-[#8B9FC4] uppercase tracking-wider text-right">Variance</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={8} className="px-6 py-12 text-center text-[#8B9FC4]">
                  Loading production data...
                </td>
              </tr>
            ) : filteredSchedules.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-6 py-12 text-center text-[#8B9FC4]">
                  No active production scheduled for this date.
                </td>
              </tr>
            ) : (
              filteredSchedules.map(sched => {
                const stage = sched.stages[activeStage]
                if (!stage) return null;
                const unitLabel = stage.unit.charAt(0).toUpperCase() + stage.unit.slice(1)
                
                return (
                  <tr key={sched.id} className="border-b border-[#243050] hover:bg-[#1A263D]/30 transition-colors">
                    <td className="px-6 py-4">
                      <div className="font-bold text-[#EEF3FF] cursor-pointer hover:text-[#D4521A] transition-colors" onClick={() => setTimelineOrder(sched.id)}>
                        {sched.customerOrderNo}
                      </div>
                      <div className="text-sm text-[#8B9FC4]">{sched.customer}</div>
                      {sched.priority === 'High' && <Badge variant="outline" className="mt-1 bg-red-500/10 text-red-500 border-red-500/20 text-[10px]">High Priority</Badge>}
                    </td>
                    
                    {/* Expected / Planned */}
                    <td className="px-6 py-4 text-right">
                      <span className="font-mono text-[#EEF3FF] text-lg">{stage.planned}</span>
                      <span className="text-xs text-[#5A6E90] ml-1">{unitLabel}</span>
                    </td>
                    
                    {/* Dynamic Inputs Based on Stage */}
                    {activeStage === 'readyForDispatch' ? (
                      <>
                        <td className="px-6 py-4 text-right">
                          <Input 
                            type="number" min="0" value={stage.completed.toString()}
                            onChange={(e) => handleStageUpdate(sched.id, 'completed', e.target.value)}
                            className="w-24 ml-auto h-10 text-right bg-[#050810] border-[#243050] text-[#EEF3FF] focus:border-[#D4521A] text-lg font-mono"
                          />
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex flex-col gap-2">
                             <Input 
                               placeholder="Invoice No" value={stage.invoiceNumber || ''}
                               onChange={(e) => handleStageUpdate(sched.id, 'invoiceNumber', e.target.value)}
                               className="h-8 bg-[#050810] border-[#243050] text-[#EEF3FF] text-xs"
                             />
                             <Input 
                               placeholder="Vehicle No" value={stage.vehicleNumber || ''}
                               onChange={(e) => handleStageUpdate(sched.id, 'vehicleNumber', e.target.value)}
                               className="h-8 bg-[#050810] border-[#243050] text-[#EEF3FF] text-xs"
                             />
                          </div>
                        </td>
                      </>
                    ) : activeStage === 'grinding' || activeStage === 'inspection' ? (
                      <>
                        <td className="px-6 py-4 text-right">
                          <Input 
                            type="number" min="0" value={stage.completed.toString()}
                            onChange={(e) => handleStageUpdate(sched.id, 'completed', e.target.value)}
                            className="w-20 ml-auto h-10 text-right bg-[#050810] border-[#243050] text-green-400 focus:border-[#D4521A] text-lg font-mono"
                          />
                        </td>
                        <td className="px-6 py-4 text-right">
                          <Input 
                            type="number" min="0" value={(stage.rework || 0).toString()}
                            onChange={(e) => handleStageUpdate(sched.id, 'rework', e.target.value)}
                            className="w-20 ml-auto h-10 text-right bg-[#050810] border-[#243050] text-yellow-400 focus:border-[#D4521A] text-lg font-mono"
                          />
                        </td>
                        <td className="px-6 py-4 text-right">
                          <Input 
                            type="number" min="0" value={(stage.rejected || 0).toString()}
                            onChange={(e) => handleStageUpdate(sched.id, 'rejected', e.target.value)}
                            className="w-20 ml-auto h-10 text-right bg-[#050810] border-[#243050] text-red-400 focus:border-[#D4521A] text-lg font-mono"
                          />
                        </td>
                      </>
                    ) : activeStage === 'knockout' ? (
                      <>
                        <td className="px-6 py-4 text-right">
                          <Input 
                            type="number" min="0" value={stage.completed.toString()}
                            onChange={(e) => handleStageUpdate(sched.id, 'completed', e.target.value)}
                            className="w-24 ml-auto h-10 text-right bg-[#050810] border-[#243050] text-[#EEF3FF] focus:border-[#D4521A] text-lg font-mono"
                          />
                        </td>
                        <td className="px-6 py-4 text-right">
                          <Input 
                            type="number" min="0" value={(stage.rejected || 0).toString()}
                            onChange={(e) => handleStageUpdate(sched.id, 'rejected', e.target.value)}
                            className="w-24 ml-auto h-10 text-right bg-[#050810] border-[#243050] text-red-400 focus:border-[#D4521A] text-lg font-mono"
                          />
                        </td>
                      </>
                    ) : (
                      <td className="px-6 py-4 text-right">
                        <Input 
                          type="number" min="0" value={stage.completed.toString()}
                          onChange={(e) => handleStageUpdate(sched.id, 'completed', e.target.value)}
                          className="w-24 ml-auto h-10 text-right bg-[#050810] border-[#243050] text-[#EEF3FF] focus:border-[#D4521A] text-lg font-mono"
                        />
                      </td>
                    )}
                    
                    {/* Pending */}
                    <td className="px-6 py-4 text-right font-mono">
                      <span className={cn(
                        "text-lg font-bold",
                        stage.pending === 0 ? "text-green-400" : "text-red-400"
                      )}>
                        {stage.pending}
                      </span>
                    </td>
                    
                    {/* Variance */}
                    <td className="px-6 py-4 text-right font-mono">
                      <span className={cn(
                        "text-lg",
                        stage.variance > 0 ? "text-blue-400" : 
                        stage.variance < 0 ? "text-red-400" : "text-[#EEF3FF]"
                      )}>
                        {stage.variance > 0 ? '+' : ''}{stage.variance}
                      </span>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      <CloseDayModal 
         isOpen={isCloseDayOpen}
         schedules={schedules}
         date={dateFilter}
         onClose={() => setIsCloseDayOpen(false)}
         onRefresh={fetchData}
      />
      
      <OrderTimelineDrawer
         isOpen={!!timelineOrder}
         scheduleId={timelineOrder!}
         onClose={() => setTimelineOrder(null)}
      />
    </div>
  )
}
