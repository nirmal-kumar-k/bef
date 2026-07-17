'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { Card } from '@/shared/ui/card'
import { Input } from '@/shared/ui/input'
import { Button } from '@/shared/ui/button'
import { Badge } from '@/shared/ui/badge'
import { cn, toLocalDateString } from '@/shared/lib/utils'
import { CheckCircle, ClockCounterClockwise, ArrowRight, MagnifyingGlass, Funnel, CalendarCheck } from '@phosphor-icons/react'
import { motion, AnimatePresence } from 'framer-motion'
import { CloseDayModal } from '@/modules/production/presentation/close-day-modal'
import { OrderTimelineDrawer } from '@/modules/production/presentation/order-timeline-drawer'

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
  const [dateFilter, setDateFilter] = useState(() => toLocalDateString(new Date()))
  
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
          <h1 className="text-3xl font-bold text-[#172554] font-heading tracking-tight">Production Tracking</h1>
          <p className="text-[#64748B] mt-1 text-sm">Monitor daily execution, actuals, and variances</p>
        </div>
        <div className="flex items-center gap-3">
          <Input 
            type="date" 
            value={dateFilter}
            onChange={e => setDateFilter(e.target.value)}
            className="w-40 bg-[#FFFFFF] border-[#E0E7FF] text-[#172554]"
          />
          <Button variant="outline" onClick={handleSaveProgress} className="border-[#E0E7FF] text-[#64748B] hover:text-[#172554] hover:bg-[#EEF2FF]">
            Save Progress
          </Button>
          <Button onClick={() => setIsCloseDayOpen(true)} disabled={schedules.length === 0} className="bg-[#4F46E5] hover:bg-[#4F46E5]/90 text-white">
            <CalendarCheck className="w-4 h-4 mr-2" />
            Close Day
          </Button>
        </div>
      </div>

      {/* KPI Dashboard Strip */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
         <Card className="bg-[#FFFFFF] border-[#E0E7FF] p-4 flex flex-row items-center justify-between">
            <div>
               <p className="text-[#64748B] text-xs font-semibold uppercase tracking-wider mb-1">Furnace Utilization</p>
               <h3 className="text-2xl font-bold text-[#172554]">{meltingUtil}%</h3>
            </div>
            <div className="text-right flex flex-col justify-center gap-1">
               <h4 className="text-[#172554] text-sm font-bold uppercase tracking-wider">Completed: {totalMeltingCompleted}</h4>
               <h4 className="text-[#172554] text-sm font-bold uppercase tracking-wider">Planned: {totalMeltingPlanned}</h4>
            </div>
         </Card>
         <Card className="bg-[#FFFFFF] border-[#E0E7FF] p-4 flex flex-row items-center justify-between">
            <div>
               <p className="text-[#64748B] text-xs font-semibold uppercase tracking-wider mb-1">Moulding Line Utilization</p>
               <h3 className="text-2xl font-bold text-[#172554]">{mouldingUtil}%</h3>
            </div>
            <div className="text-right flex flex-col justify-center gap-1">
               <h4 className="text-[#172554] text-sm font-bold uppercase tracking-wider">Completed: {totalMouldingCompleted}</h4>
               <h4 className="text-[#172554] text-sm font-bold uppercase tracking-wider">Planned: {totalMouldingPlanned}</h4>
            </div>
         </Card>
         <Card className="bg-[#FFFFFF] border-[#E0E7FF] p-4 flex flex-row items-center justify-between">
            <div>
               <p className="text-[#64748B] text-xs font-semibold uppercase tracking-wider mb-1">Active Scheduled Jobs</p>
               <h3 className="text-2xl font-bold text-[#172554]">{schedules.length}</h3>
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
                  ? "text-[#172554] bg-[#EEF2FF] shadow-[inset_0_1px_0_rgba(255,255,255,0.1)] border border-[#E0E7FF]"
                  : "text-[#94A3B8] hover:text-[#0F172A] hover:bg-[#FFFFFF] border border-transparent"
              )}
            >
              <div className="flex items-center gap-2 relative z-10">
                {activeStage === stage.key ? (
                  <CheckCircle weight="fill" className="w-4 h-4 text-[#4F46E5]" />
                ) : (
                  <ClockCounterClockwise weight="bold" className="w-4 h-4 opacity-50" />
                )}
                {stage.label}
              </div>
            </button>
            
            {idx < STAGES.length - 1 && (
              <ArrowRight weight="bold" className="w-3 h-3 text-[#E0E7FF] mx-1" />
            )}
          </div>
        ))}
      </div>

      {/* Search Bar */}
      <div className="relative">
         <MagnifyingGlass className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#94A3B8]" />
         <Input 
            type="text" 
            placeholder="Search by Order No or Customer..." 
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9 bg-[#FFFFFF] border-[#E0E7FF] text-[#172554]"
         />
      </div>

      {/* Main Table */}
      <div className="bg-[#FFFFFF] border border-[#E0E7FF] rounded-xl overflow-hidden mt-6">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-[#EEF2FF] border-b border-[#E0E7FF]">
              <th className="px-4 py-3 text-xs font-semibold text-[#64748B] uppercase tracking-wider w-[25%]">Order Info</th>
              <th className="px-4 py-3 text-xs font-semibold text-[#64748B] uppercase tracking-wider text-center w-[15%]">Expected/Planned</th>
              
              {activeStage === 'readyForDispatch' ? (
                <>
                  <th className="px-4 py-3 text-xs font-semibold text-[#64748B] uppercase tracking-wider text-center w-[15%]">Dispatch Qty</th>
                  <th className="px-4 py-3 text-xs font-semibold text-[#64748B] uppercase tracking-wider text-center w-[25%]">Logistics (Inv / Veh)</th>
                </>
              ) : activeStage === 'grinding' || activeStage === 'inspection' ? (
                <>
                  <th className="px-4 py-3 text-xs font-semibold text-[#64748B] uppercase tracking-wider text-center w-[10%]">Completed</th>
                  <th className="px-4 py-3 text-xs font-semibold text-[#64748B] uppercase tracking-wider text-center w-[10%]">Rework</th>
                  <th className="px-4 py-3 text-xs font-semibold text-[#64748B] uppercase tracking-wider text-center w-[10%]">Rejected</th>
                </>
              ) : activeStage === 'knockout' ? (
                <>
                  <th className="px-4 py-3 text-xs font-semibold text-[#64748B] uppercase tracking-wider text-center w-[15%]">Completed</th>
                  <th className="px-4 py-3 text-xs font-semibold text-[#64748B] uppercase tracking-wider text-center w-[15%]">Damaged (Rej)</th>
                </>
              ) : (
                <th className="px-4 py-3 text-xs font-semibold text-[#64748B] uppercase tracking-wider text-center w-[30%]">Completed</th>
              )}
              
              <th className="px-4 py-3 text-xs font-semibold text-[#64748B] uppercase tracking-wider text-center w-[15%]">Pending</th>
              <th className="px-4 py-3 text-xs font-semibold text-[#64748B] uppercase tracking-wider text-center w-[15%]">Variance</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={8} className="px-6 py-12 text-center text-[#64748B]">
                  Loading production data...
                </td>
              </tr>
            ) : filteredSchedules.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-6 py-12 text-center text-[#64748B]">
                  No active production scheduled for this date.
                </td>
              </tr>
            ) : (
              filteredSchedules.map(sched => {
                const stage = sched.stages[activeStage]
                if (!stage) return null;
                const unitLabel = stage.unit.charAt(0).toUpperCase() + stage.unit.slice(1)
                
                return (
                  <tr key={sched.id} className="border-b border-[#E0E7FF] hover:bg-[#EEF2FF]/30 transition-colors">
                    <td className="px-4 py-3">
                      <div className="font-bold text-[#172554] cursor-pointer hover:text-[#4F46E5] transition-colors" onClick={() => setTimelineOrder(sched.id)}>
                        {sched.customerOrderNo}
                      </div>
                      <div className="text-sm text-[#64748B]">{sched.customer}</div>
                      {sched.priority === 'High' && <Badge variant="outline" className="mt-1 bg-red-500/10 text-red-500 border-red-500/20 text-[10px]">High Priority</Badge>}
                    </td>
                    
                    {/* Planned */}
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <span className="text-[#172554] font-bold text-base">{stage.planned}</span>
                        <span className="text-[#94A3B8] text-xs">{stage.unit}</span>
                      </div>
                    </td>
                    
                    {/* Actual Input */}
                    {activeStage === 'readyForDispatch' ? (
                      <>
                        <td className="px-4 py-3 text-center">
                          <Input 
                            type="number" min="0" value={stage.completed.toString()}
                            onChange={(e) => handleStageUpdate(sched.id, 'completed', e.target.value)}
                            className="w-12 mx-auto h-7 text-xs font-mono font-medium text-center bg-[#172554]/10 border-transparent text-[#172554] rounded-md focus:border-[#4F46E5] transition-colors px-1 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                          />
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-col items-center gap-2">
                            <Input 
                              placeholder="Invoice No." value={stage.invoiceNumber || ''}
                              onChange={(e) => handleStageUpdate(sched.id, 'invoiceNumber', e.target.value)}
                              className="w-32 h-8 text-xs bg-[#F4F6FB] border-[#E0E7FF] text-[#172554] focus:border-[#4F46E5] text-center"
                            />
                            <Input 
                              placeholder="Vehicle No." value={stage.vehicleNumber || ''}
                              onChange={(e) => handleStageUpdate(sched.id, 'vehicleNumber', e.target.value)}
                              className="w-32 h-8 text-xs bg-[#F4F6FB] border-[#E0E7FF] text-[#172554] focus:border-[#4F46E5] text-center"
                            />
                          </div>
                        </td>
                      </>
                    ) : activeStage === 'grinding' || activeStage === 'inspection' ? (
                      <>
                        <td className="px-4 py-3 text-center">
                          <Input 
                            type="number" min="0" value={stage.completed.toString()}
                            onChange={(e) => handleStageUpdate(sched.id, 'completed', e.target.value)}
                            className="w-12 mx-auto h-7 text-xs font-mono font-medium text-center bg-green-500/10 border-transparent text-green-400 rounded-md focus:border-green-500 transition-colors px-1 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                          />
                        </td>
                        <td className="px-4 py-3 text-center">
                          <Input 
                            type="number" min="0" value={(stage.rework || 0).toString()}
                            onChange={(e) => handleStageUpdate(sched.id, 'rework', e.target.value)}
                            className="w-12 mx-auto h-7 text-xs font-mono font-medium text-center bg-yellow-500/10 border-transparent text-yellow-400 rounded-md focus:border-yellow-500 transition-colors px-1 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                          />
                        </td>
                        <td className="px-4 py-3 text-center">
                          <Input 
                            type="number" min="0" value={(stage.rejected || 0).toString()}
                            onChange={(e) => handleStageUpdate(sched.id, 'rejected', e.target.value)}
                            className="w-12 mx-auto h-7 text-xs font-mono font-medium text-center bg-red-500/10 border-transparent text-red-400 rounded-md focus:border-red-500 transition-colors px-1 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                          />
                        </td>
                      </>
                    ) : activeStage === 'knockout' ? (
                      <>
                        <td className="px-4 py-3 text-center">
                          <Input 
                            type="number" min="0" value={stage.completed.toString()}
                            onChange={(e) => handleStageUpdate(sched.id, 'completed', e.target.value)}
                            className="w-12 mx-auto h-7 text-xs font-mono font-medium text-center bg-[#172554]/10 border-transparent text-[#172554] rounded-md focus:border-[#4F46E5] transition-colors px-1 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                          />
                        </td>
                        <td className="px-4 py-3 text-center">
                          <Input 
                            type="number" min="0" value={(stage.rejected || 0).toString()}
                            onChange={(e) => handleStageUpdate(sched.id, 'rejected', e.target.value)}
                            className="w-12 mx-auto h-7 text-xs font-mono font-medium text-center bg-red-500/10 border-transparent text-red-400 rounded-md focus:border-red-500 transition-colors px-1 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                          />
                        </td>
                      </>
                    ) : (
                      <td className="px-4 py-3 text-center">
                        <Input 
                          type="number" min="0" value={stage.completed.toString()}
                          onChange={(e) => handleStageUpdate(sched.id, 'completed', e.target.value)}
                          className="w-12 mx-auto h-7 text-xs font-mono font-medium text-center bg-[#172554]/10 border-transparent text-[#172554] rounded-md focus:border-[#4F46E5] transition-colors px-1 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                        />
                      </td>
                    )}
                    
                    {/* Pending */}
                    <td className="px-4 py-3 text-center font-mono">
                      <span className={cn(
                        "text-lg font-bold",
                        stage.pending === 0 ? "text-green-400" : "text-red-400"
                      )}>
                        {stage.pending}
                      </span>
                    </td>
                    
                    {/* Variance */}
                    <td className="px-4 py-3 text-center font-mono">
                      <span className={cn(
                        "text-lg",
                        stage.variance > 0 ? "text-blue-400" : 
                        stage.variance < 0 ? "text-red-400" : "text-[#172554]"
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
