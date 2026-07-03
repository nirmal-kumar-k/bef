import React, { useState, useEffect } from 'react'
import { X } from 'lucide-react'
import { CalendarCheck } from '@phosphor-icons/react'
import { Button } from '@/shared/ui/button'
import { Input } from '@/shared/ui/input'
import { Label } from '@/shared/ui/label'
import { cn } from '@/shared/lib/utils'

export interface CloseDayModalProps {
  isOpen: boolean;
  schedules: any[];
  date: string;
  onClose: () => void;
  onRefresh: () => Promise<void>;
}

export function CloseDayModal({ isOpen, schedules, date, onClose, onRefresh }: CloseDayModalProps) {
  const [localSchedules, setLocalSchedules] = useState<any[]>([])
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    if (isOpen) {
      setLocalSchedules(JSON.parse(JSON.stringify(schedules)))
    }
  }, [isOpen, schedules])

  if (!isOpen) return null

  const displayDate = new Date(date).toLocaleDateString(undefined, {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
  })

  const handleActualChange = (idx: number, stageKey: string, value: string) => {
    const newSchedules = [...localSchedules]
    const stage = newSchedules[idx].stages[stageKey]
    const val = parseInt(value, 10) || 0
    stage.completed = val
    stage.pending = Math.max(0, stage.planned - stage.completed)
    stage.variance = stage.completed - stage.planned
    
    setLocalSchedules(newSchedules)
  }

  const handleCloseDay = async () => {
    setIsSaving(true)
    try {
      // 1. Save all actuals entered in this modal for today's date
      const updatedSchedules = localSchedules.map(s => ({
         ...s,
         status: 'Completed'
      }))
      
      await fetch('/api/schedules', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedSchedules)
      })
      
      // 2. Handle Carry-Forward (Shortfall) and Over-Production
      const tomorrow = new Date(date)
      tomorrow.setDate(tomorrow.getDate() + 1)
      const tomorrowStr = tomorrow.toISOString().split('T')[0]
      
      const newSchedules = []
      
      for (const s of localSchedules) {
         let hasCarryForward = false
         const newStages = JSON.parse(JSON.stringify(s.stages))
         
         Object.keys(newStages).forEach(key => {
            const stage = newStages[key]
            
            let carryForwardQuantity = 0;
            if (stage.planned > 0) {
               if (stage.completed < stage.planned) {
                  carryForwardQuantity += (stage.planned - stage.completed)
               }
            }
            if (stage.rework && stage.rework > 0) {
               carryForwardQuantity += stage.rework
            }
            
            if (carryForwardQuantity > 0) {
               stage.planned = carryForwardQuantity
               stage.completed = 0
               stage.pending = carryForwardQuantity
               stage.variance = -carryForwardQuantity
               stage.rework = 0
               stage.rejected = 0
               hasCarryForward = true
            } else {
               stage.planned = 0
               stage.completed = 0
               stage.pending = 0
               stage.variance = 0
               stage.rework = 0
               stage.rejected = 0
            }
         })
         
         if (hasCarryForward) {
            newSchedules.push({
               orderId: s.orderId,
               date: tomorrowStr,
               shift: s.shift,
               priority: s.priority,
               remarks: 'Carried forward from ' + displayDate,
               status: 'Planned',
               stages: newStages
            })
         }
      }
      
      if (newSchedules.length > 0) {
         await fetch('/api/schedules', {
           method: 'POST',
           headers: { 'Content-Type': 'application/json' },
           body: JSON.stringify(newSchedules)
         })
      }
      
      await onRefresh()
      onClose()
    } catch (err) {
      console.error('Failed to close day', err)
    } finally {
      setIsSaving(false)
    }
  }

  const drawerContent = (
    <>
      <div 
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] transition-opacity duration-300" 
        onClick={onClose}
      />
      
      <div className="fixed inset-0 z-[101] flex items-start justify-center pt-8 pb-4 px-4">
        <div className="bg-[#FFFFFF] border border-[#E0E7FF] rounded-2xl w-full max-w-[1200px] shadow-2xl flex flex-col overflow-hidden max-h-[90vh]">
          {/* Header */}
          <div className="px-6 py-5 flex items-center justify-between shrink-0">
            <div>
              <h2 className="text-xl font-bold text-[#172554] tracking-tight flex items-center gap-2">
                 <CalendarCheck weight="duotone" className="w-6 h-6 text-[#4F46E5]" />
                 End of Day Production Entry
              </h2>
              <p className="text-[#64748B] text-sm mt-1">{displayDate}</p>
            </div>
            <button onClick={onClose} className="p-2 text-[#94A3B8] hover:text-[#172554] hover:bg-[#EEF2FF] rounded-lg transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="px-6 pb-6 overflow-y-auto space-y-6">
             <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4">
               <p className="text-blue-400 text-sm">
                  Enter the Actual Quantity completed for each scheduled process today. 
                  If actuals fall short of the plan, the remaining balance will be automatically carried forward to tomorrow's schedule. Over-production will automatically adjust future balances.
               </p>
             </div>
             
             {localSchedules.length === 0 ? (
               <p className="text-[#64748B] text-center py-4">No schedules found for this day.</p>
             ) : (
                 <div className="space-y-5">
                   {localSchedules.map((s, idx) => (
                      <div key={s.id} className="bg-[#F4F6FB] border border-[#E0E7FF] rounded-xl p-5 space-y-4">
                         <div className="flex justify-between items-center pb-3 border-b border-[#E0E7FF]">
                            <div>
                               <h3 className="text-lg font-bold text-[#172554]">{s.customerOrderNo}</h3>
                               <p className="text-[#64748B] text-sm mt-0.5">{s.customer}</p>
                            </div>
                         </div>
                         
                         <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                               <thead>
                                  <tr>
                                     <th className="py-3 px-4 text-xs font-semibold text-[#64748B] uppercase tracking-wider bg-[#FFFFFF]/50 first:rounded-tl-lg">Stage</th>
                                     <th className="py-3 px-4 text-xs font-semibold text-[#64748B] uppercase tracking-wider bg-[#FFFFFF]/50 text-center">Planned</th>
                                     <th className="py-3 px-4 text-xs font-semibold text-[#64748B] uppercase tracking-wider bg-[#FFFFFF]/50">Unit</th>
                                     <th className="py-3 px-4 text-xs font-semibold text-[#64748B] uppercase tracking-wider bg-[#FFFFFF]/50 w-40 text-center">Actual Completed</th>
                                     <th className="py-3 px-4 text-xs font-semibold text-[#64748B] uppercase tracking-wider bg-[#FFFFFF]/50 text-center last:rounded-tr-lg">Variance</th>
                                  </tr>
                               </thead>
                               <tbody className="divide-y divide-[#E0E7FF]/50">
                                  {['core', 'melting', 'moulding', 'pouring', 'knockout', 'shotBlasting', 'grinding', 'inspection', 'readyForDispatch'].map(stageKey => {
                                     const stage = s.stages[stageKey as keyof typeof s.stages]
                                     if (!stage || (stage.planned === 0 && stage.completed === 0)) return null
                                     
                                     // Format the stage key nicely
                                     const stageName = stageKey.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())

                                     return (
                                        <tr key={stageKey} className="hover:bg-[#FFFFFF]/30 transition-colors group">
                                           <td className="py-2.5 px-4 text-[#172554] font-medium text-sm">{stageName}</td>
                                           <td className="py-2.5 px-4 text-[#172554] text-sm text-center font-mono">{stage.planned}</td>
                                           <td className="py-2.5 px-4 text-[#94A3B8] text-xs uppercase tracking-wider">{stage.unit}</td>
                                           <td className="py-2 px-4 text-center">
                                              <Input 
                                                 type="number" 
                                                 min="0"
                                                 value={stage.completed?.toString() || '0'}
                                                 onChange={(e) => handleActualChange(idx, stageKey, e.target.value)}
                                                 className="h-7 w-12 mx-auto text-xs font-mono font-medium text-center bg-[#172554]/10 border-transparent text-[#172554] rounded-md focus:border-[#4F46E5] focus:bg-[#FFFFFF] transition-colors px-1 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" 
                                                 placeholder="0"
                                              />
                                           </td>
                                           <td className="py-2.5 px-4 text-center">
                                              {stage.variance !== 0 ? (
                                                <span className={cn("text-xs font-mono font-medium px-2 py-1 rounded-md", (stage.variance || 0) > 0 ? "bg-blue-500/10 text-blue-400" : "bg-red-500/10 text-red-400")}>
                                                   {(stage.variance || 0) > 0 ? '+' : ''}{stage.variance || 0}
                                                </span>
                                              ) : (
                                                <span className="text-[#94A3B8] text-xs font-mono">-</span>
                                              )}
                                           </td>
                                        </tr>
                                     )
                                  })}
                               </tbody>
                            </table>
                         </div>
                      </div>
                   ))}
                </div>
             )}
          </div>
          
          {/* Footer */}
          <div className="px-6 py-4 flex justify-end gap-3 shrink-0 bg-[#FFFFFF] border-t border-[#E0E7FF]">
             <Button variant="outline" onClick={onClose} className="border-[#E0E7FF] text-[#64748B] hover:text-[#172554] hover:bg-[#EEF2FF] px-5 py-2 text-sm h-auto">
                Cancel
             </Button>
             <Button onClick={handleCloseDay} disabled={isSaving || localSchedules.length === 0} className="bg-[#4F46E5] hover:bg-[#4F46E5]/90 text-white px-5 py-2 text-sm h-auto font-medium">
                {isSaving ? 'Saving...' : 'Confirm & Close Day'}
             </Button>
          </div>
        </div>
      </div>
    </>
  )

  return drawerContent
}
