'use client'

import { useState, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { cn } from '@/shared/lib/utils'
import { X, CheckCircle, ClockCounterClockwise, MapPinLine } from '@phosphor-icons/react'

export function OrderTimelineDrawer({
  isOpen,
  scheduleId,
  onClose
}: {
  isOpen: boolean
  scheduleId: string
  onClose: () => void
}) {
  const [schedule, setSchedule] = useState<any>(null)
  const [loading, setLoading] = useState(false)

  const fetchScheduleDetails = useCallback(async () => {
    if (!scheduleId) return
    setLoading(true)
    try {
      // For a real production app we'd fetch the specific schedule by ID, 
      // but for this demo, we'll fetch all and find it since the route /api/schedules/[id] might not be built perfectly for GET yet.
      const res = await fetch('/api/schedules')
      const data = await res.json()
      const found = data.find((s: any) => s.id === scheduleId)
      if (found) {
        setSchedule(found)
      }
    } catch (err) {
      console.error('Failed to fetch schedule details', err)
    } finally {
      setLoading(false)
    }
  }, [scheduleId])

  useEffect(() => {
    if (isOpen) {
      fetchScheduleDetails()
    } else {
      setTimeout(() => setSchedule(null), 300) // Clear after animation
    }
  }, [isOpen, fetchScheduleDetails])

  if (!isOpen && !schedule) return null

  const STAGES = [
    { key: 'core', label: 'Core Making' },
    { key: 'moulding', label: 'Moulding' },
    { key: 'melting', label: 'Melting' },
    { key: 'pouring', label: 'Pouring' },
    { key: 'knockout', label: 'Knockout' },
    { key: 'shotBlasting', label: 'Shot Blasting' },
    { key: 'grinding', label: 'Grinding' },
    { key: 'inspection', label: 'Inspection' },
    { key: 'readyForDispatch', label: 'Ready for Dispatch' }
  ]

  const drawerContent = (
    <>
      <div 
        className={cn(
          "fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] transition-opacity duration-300",
          isOpen ? "opacity-100" : "opacity-0 pointer-events-none"
        )} 
        onClick={onClose}
      />
      
      <div 
        className={cn(
          "fixed inset-y-0 right-0 w-[500px] max-w-[90vw] bg-[#050810] border-l border-[#243050] z-[101] shadow-2xl transition-transform duration-300 ease-out flex flex-col",
          isOpen ? "translate-x-0" : "translate-x-full"
        )}
      >
        {/* Header */}
        <div className="sticky top-0 z-10 bg-[#0C1221]/95 backdrop-blur-md border-b border-[#243050] px-6 py-5 flex items-center justify-between shrink-0">
          <div>
            <h2 className="text-xl font-bold text-[#EEF3FF] tracking-tight">Production Timeline</h2>
            <p className="text-[#8B9FC4] text-sm mt-1">{schedule?.customerOrderNo || 'Loading...'}</p>
          </div>
          <button onClick={onClose} className="p-2 text-[#5A6E90] hover:text-[#EEF3FF] hover:bg-[#1A263D] rounded-lg transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {loading || !schedule ? (
            <div className="flex flex-col items-center justify-center h-40 space-y-4">
              <div className="w-8 h-8 border-4 border-[#243050] border-t-[#D4521A] rounded-full animate-spin" />
              <p className="text-[#8B9FC4]">Loading timeline...</p>
            </div>
          ) : (
            <div className="space-y-8">
               {/* Order Context */}
               <div className="bg-[#0C1221] border border-[#243050] rounded-xl p-4">
                  <div className="grid grid-cols-2 gap-4">
                     <div>
                        <p className="text-[#5A6E90] text-xs uppercase tracking-wider mb-1">Customer</p>
                        <p className="text-[#EEF3FF] font-medium">{schedule.customer}</p>
                     </div>
                     <div>
                        <p className="text-[#5A6E90] text-xs uppercase tracking-wider mb-1">Schedule Date</p>
                        <p className="text-[#EEF3FF] font-medium">{new Date(schedule.date).toLocaleDateString()}</p>
                     </div>
                  </div>
               </div>

               {/* Timeline Stepper */}
               <div className="relative pl-4 space-y-8 before:absolute before:inset-y-0 before:left-[23px] before:w-px before:bg-[#243050]">
                  {STAGES.map((stage, idx) => {
                     const stageData = schedule.stages[stage.key] || { planned: 0, completed: 0, pending: 0, variance: 0 }
                     const isCompleted = stageData.completed > 0 && stageData.completed >= stageData.planned
                     const isInProgress = stageData.completed > 0 && stageData.completed < stageData.planned
                     const hasPlanned = stageData.planned > 0
                     
                     if (!hasPlanned && !isCompleted && !isInProgress) return null // Skip entirely empty stages for this schedule date to keep timeline clean

                     return (
                        <div key={stage.key} className="relative flex gap-6">
                           <div className={cn(
                              "relative z-10 flex shrink-0 items-center justify-center w-5 h-5 rounded-full mt-1 border-2",
                              isCompleted ? "bg-[#1A263D] border-green-500 text-green-500" :
                              isInProgress ? "bg-[#1A263D] border-[#D4521A] text-[#D4521A]" :
                              "bg-[#050810] border-[#5A6E90] text-[#5A6E90]"
                           )}>
                              {isCompleted ? <CheckCircle weight="fill" className="w-5 h-5 absolute -left-[2px] -top-[2px] bg-green-500 text-[#050810] rounded-full" /> : <div className="w-2 h-2 rounded-full bg-current" />}
                           </div>
                           
                           <div className="flex-1 bg-[#0C1221] border border-[#243050] rounded-xl p-4 transition-colors hover:border-[#5A6E90]">
                              <h3 className={cn("text-sm font-bold uppercase tracking-wider mb-3", isCompleted ? "text-green-400" : "text-[#EEF3FF]")}>
                                 {stage.label}
                              </h3>
                              
                              <div className="grid grid-cols-3 gap-2">
                                 <div className="bg-[#050810] rounded-md p-2 text-center">
                                    <p className="text-[#5A6E90] text-[10px] uppercase mb-1">Planned</p>
                                    <p className="text-[#EEF3FF] font-mono text-lg">{stageData.planned}</p>
                                 </div>
                                 <div className="bg-[#050810] rounded-md p-2 text-center">
                                    <p className="text-[#5A6E90] text-[10px] uppercase mb-1">Completed</p>
                                    <p className="text-[#EEF3FF] font-mono text-lg">{stageData.completed}</p>
                                 </div>
                                 <div className="bg-[#050810] rounded-md p-2 text-center">
                                    <p className="text-[#5A6E90] text-[10px] uppercase mb-1">Pending</p>
                                    <p className="text-[#EEF3FF] font-mono text-lg">{stageData.pending}</p>
                                 </div>
                              </div>
                           </div>
                        </div>
                     )
                  })}
               </div>
            </div>
          )}
        </div>
      </div>
    </>
  )

  if (typeof document === 'undefined') return null
  return createPortal(drawerContent, document.body)
}
