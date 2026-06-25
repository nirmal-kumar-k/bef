'use client'

import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { Button } from '@/shared/ui/button'
import { cn } from '@/shared/lib/utils'
import { Badge } from '@/shared/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/ui/select'
import { X, CalendarPlus } from '@phosphor-icons/react'

export interface Schedule {
  id: string
  orderId: string
  date: string
  stage: 'Moulding' | 'Melting' | 'Fettling'
  customerOrderNo: string
  customer: string
  pattern: string
  product: string
  quantity: number
  plannedQuantity: number
  actualQuantity: number
}

interface Order {
  id: string
  customerOrderNo: string
  customer: string
  status: string
}

export function ScheduleDrawer({
  isOpen,
  date,
  schedules,
  orders,
  onClose,
  onSchedule,
  onRemove,
  onSaveEntries,
}: {
  isOpen: boolean
  date: string
  schedules: Schedule[]
  orders: Order[]
  onClose: () => void
  onSchedule: (orderId: string, stage: string) => Promise<void>
  onRemove: (id: string) => Promise<void>
  onSaveEntries: (entries: Record<string, { planned: number, actual: number }>) => Promise<void>
}) {
  const [showForm, setShowForm] = useState(false)
  const [selectedOrder, setSelectedOrder] = useState<string>('')
  const [selectedStage, setSelectedStage] = useState<string>('Moulding')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  
  const [entries, setEntries] = useState<Record<string, { planned: number | '', actual: number | '' }>>({})
  const [isFading, setIsFading] = useState(false)
  const [prevDate, setPrevDate] = useState(date)
  const [mounted, setMounted] = useState(false)
  const [activeStageScheduleId, setActiveStageScheduleId] = useState<string | null>(null)

  const stageProcesses = {
    Moulding: [
      { id: 'm1', name: 'Sand Preparation', status: 'Pending' },
      { id: 'm2', name: 'Pattern Setup', status: 'Pending' },
      { id: 'm3', name: 'Core Placement', status: 'Pending' },
      { id: 'm4', name: 'Mould Assembly', status: 'Pending' },
    ],
    Melting: [
      { id: 'me1', name: 'Charge Calculation', status: 'Pending' },
      { id: 'me2', name: 'Furnace Charging', status: 'Pending' },
      { id: 'me3', name: 'Temperature Check', status: 'Pending' },
      { id: 'me4', name: 'Pouring', status: 'Pending' },
    ],
    Fettling: [
      { id: 'f1', name: 'Knockout', status: 'Pending' },
      { id: 'f2', name: 'Runner/Riser Cutting', status: 'Pending' },
      { id: 'f3', name: 'Shot Blasting', status: 'Pending' },
      { id: 'f4', name: 'Grinding', status: 'Pending' },
      { id: 'f5', name: 'Quality Inspection', status: 'Pending' },
    ]
  }

  useEffect(() => {
    setMounted(true)
  }, [])

  // Fade animation logic on date change
  useEffect(() => {
    if (date !== prevDate && isOpen) {
      setIsFading(true)
      const timer = setTimeout(() => {
        const newEntries: Record<string, { planned: number | '', actual: number | '' }> = {}
        schedules.forEach(s => {
          newEntries[s.id] = { 
            planned: s.plannedQuantity !== undefined && s.plannedQuantity !== 0 ? s.plannedQuantity : '', 
            actual: s.actualQuantity !== undefined && s.actualQuantity !== 0 ? s.actualQuantity : '' 
          }
        })
        setEntries(newEntries)
        setPrevDate(date)
        setIsFading(false)
      }, 150)
      return () => clearTimeout(timer)
    } else {
      const newEntries: Record<string, { planned: number | '', actual: number | '' }> = {}
      schedules.forEach(s => {
        newEntries[s.id] = { 
          planned: s.plannedQuantity !== undefined && s.plannedQuantity !== 0 ? s.plannedQuantity : '', 
          actual: s.actualQuantity !== undefined && s.actualQuantity !== 0 ? s.actualQuantity : '' 
        }
      })
      setEntries(newEntries)
      setPrevDate(date)
    }
  }, [date, prevDate, schedules, isOpen])

  // Filter orders to only Received or In Progress
  const validOrders = orders.filter(
    o => o.status === 'Received' || o.status === 'In Progress'
  )

  const handleClose = () => {
    setShowForm(false)
    setSelectedOrder('')
    setSelectedStage('Moulding')
    onClose()
  }

  const handleSchedule = async () => {
    if (!selectedOrder || !selectedStage) return
    setIsSubmitting(true)
    await onSchedule(selectedOrder, selectedStage)
    setIsSubmitting(false)
    setShowForm(false)
    setSelectedOrder('')
    setSelectedStage('Moulding')
  }

  const handleSave = async () => {
    try {
      setIsSaving(true)
      await onSaveEntries(entries)
      // Smooth exit after details are saved
      handleClose()
    } finally {
      setIsSaving(false)
    }
  }

  // Format date for display
  const displayDate = date ? new Date(date).toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  }) : ''

  const getBadgeColor = (stage: string) => {
    switch (stage) {
      case 'Moulding': return 'bg-blue-500/10 text-blue-500 border-blue-500/20'
      case 'Melting': return 'bg-orange-500/10 text-orange-500 border-orange-500/20'
      case 'Fettling': return 'bg-green-500/10 text-green-500 border-green-500/20'
      default: return 'bg-gray-500/10 text-gray-400 border-gray-500/20'
    }
  }

  if (!mounted) return null;

  return createPortal(
    <>
      {/* Blurred Backdrop */}
      <div 
        className={cn(
          "fixed inset-0 z-40 bg-[#050810]/40 backdrop-blur-sm transition-opacity duration-300",
          isOpen ? "opacity-100" : "opacity-0 pointer-events-none"
        )}
        onClick={handleClose}
      />

      {/* Left-side Sub-Drawer for Stage Details */}
      <div 
        className={cn(
          "fixed top-6 left-6 h-[calc(100vh-3rem)] w-full sm:w-[350px] bg-[#050810] border border-[#243050] rounded-2xl z-[60] flex flex-col transform transition-transform duration-300 ease-out shadow-2xl overflow-hidden ring-1 ring-white/5",
          activeStageScheduleId ? "translate-x-0" : "-translate-x-[calc(100%+3rem)]"
        )}
      >
        {activeStageScheduleId && (() => {
          const s = schedules.find(x => x.id === activeStageScheduleId)
          if (!s) return null
          const processes = stageProcesses[s.stage]

          return (
            <>
              <div className="px-6 py-5 border-b border-[#243050] bg-[#0C1221]">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="text-xl font-bold text-[#EEF3FF] tracking-tight">{s.stage} Details</h3>
                    <p className="text-xs text-[#5A6E90] mt-1 truncate max-w-[250px]">{s.product}</p>
                  </div>
                  <button onClick={() => setActiveStageScheduleId(null)} className="text-[#8B9FC4] hover:text-[#EEF3FF] transition-colors mt-1">
                    <X weight="bold" className="h-5 w-5" />
                  </button>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto p-6 space-y-4">
                <div className="flex items-center gap-3 bg-[#1A263D]/30 p-3 rounded-lg border border-[#243050]/50 mb-6">
                  <Badge variant="outline" className={cn(getBadgeColor(s.stage), "px-2 py-0.5")}>{s.stage}</Badge>
                  <p className="text-sm text-[#8B9FC4]">Processes required for this stage.</p>
                </div>
                
                <div className="space-y-3">
                  {processes.map((proc, i) => (
                    <div key={proc.id} className="flex items-center justify-between p-3 rounded-lg border border-white/[0.04] bg-[#0C1221] hover:bg-[#1A263D]/50 transition-colors cursor-pointer group">
                      <div className="flex items-center gap-3">
                        <div className="h-6 w-6 rounded bg-[#243050] flex items-center justify-center text-[10px] font-bold text-[#8B9FC4] group-hover:text-[#EEF3FF] transition-colors">
                          {i + 1}
                        </div>
                        <p className="text-sm font-medium text-[#EEF3FF]">{proc.name}</p>
                      </div>
                      <div className="h-4 w-4 rounded border border-[#5A6E90] hover:border-[#D4521A] transition-colors flex items-center justify-center">
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )
        })()}
      </div>

      <div 
        className={cn(
          "fixed top-6 right-6 h-[calc(100vh-3rem)] w-full sm:w-[600px] md:w-[860px] max-w-[calc(100vw-3rem)] bg-[#050810] border border-[#243050] rounded-2xl z-50 flex flex-col transform transition-transform duration-300 ease-out shadow-2xl ring-1 ring-white/5 overflow-hidden",
          isOpen ? "translate-x-0" : "translate-x-[calc(100%+3rem)]"
        )}
      >
      {/* Top Header */}
      <div className="flex items-start justify-between px-6 py-5 border-b border-[#243050] shrink-0 bg-[#050810] z-10 sticky top-0">
        <div>
          <h2 className="text-2xl font-bold font-heading text-[#EEF3FF] tracking-tight">{displayDate}</h2>
          <p className="text-sm text-[#5A6E90] mt-1">Manage production quantities and schedule new orders for this date</p>
        </div>
        <button onClick={handleClose} className="text-[#8B9FC4] hover:text-[#EEF3FF] transition-colors mt-1">
          <X weight="bold" className="h-5 w-5" />
        </button>
      </div>

      {/* Main Content Area */}
      <div className={cn("px-6 py-6 space-y-6 flex-1 overflow-y-auto transition-opacity duration-150", isFading ? "opacity-0" : "opacity-100")}>
        
        {/* Schedule New Order Section (Inline) */}
        {showForm && (
          <div className="p-6 bg-[#0C1221] border border-white/[0.06] rounded-[14px] space-y-5 mb-6 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-lg font-bold text-[#EEF3FF] tracking-tight">New Schedule Entry</h4>
              <button onClick={() => setShowForm(false)} className="text-[#5A6E90] hover:text-[#EEF3FF]"><X weight="bold" /></button>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-[12px] text-[#8B9FC4] uppercase font-semibold tracking-wider">Order</label>
                <Select value={selectedOrder} onValueChange={setSelectedOrder}>
                  <SelectTrigger className="w-full bg-[#050810] border-white/[0.06] text-[#EEF3FF] h-12 rounded-lg">
                    <SelectValue placeholder="Select an order" />
                  </SelectTrigger>
                  <SelectContent className="bg-[#050810] border-[#243050] max-h-60">
                    {validOrders.length === 0 ? (
                      <div className="p-2 text-sm text-[#5A6E90] text-center">No pending orders</div>
                    ) : (
                      validOrders.map(order => (
                        <SelectItem key={order.id} value={order.id} className="text-[#EEF3FF]">
                          {order.customerOrderNo} — {order.customer}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-[12px] text-[#8B9FC4] uppercase font-semibold tracking-wider">Process Stage</label>
                <Select value={selectedStage} onValueChange={setSelectedStage}>
                  <SelectTrigger className="w-full bg-[#050810] border-white/[0.06] text-[#EEF3FF] h-12 rounded-lg">
                    <SelectValue placeholder="Select process stage" />
                  </SelectTrigger>
                  <SelectContent className="bg-[#050810] border-[#243050]">
                    <SelectItem value="Moulding" className="text-[#EEF3FF]">Moulding</SelectItem>
                    <SelectItem value="Melting" className="text-[#EEF3FF]">Melting</SelectItem>
                    <SelectItem value="Fettling" className="text-[#EEF3FF]">Fettling</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <Button 
                onClick={handleSchedule} 
                disabled={!selectedOrder || !selectedStage || isSubmitting}
                className="bg-[#D4521A] hover:bg-[#D4521A]/90 text-white px-6 py-5 rounded-lg font-semibold shadow-lg shadow-[#D4521A]/20 disabled:opacity-50"
              >
                Confirm Order
              </Button>
            </div>
          </div>
        )}

        <div className="space-y-4">
          {schedules.length === 0 ? (
            <div className="py-20 text-center border border-dashed border-[#243050] rounded-xl bg-[#0C1221]/30">
              <p className="text-[#8B9FC4] text-lg font-medium">No orders scheduled</p>
              <p className="text-[#5A6E90] text-sm mt-1">Schedule an order to get started</p>
            </div>
          ) : (
            <div className="space-y-3">
              <h4 className="text-[12px] font-bold text-[#5A6E90] uppercase tracking-widest mb-4">Scheduled Orders</h4>
              {schedules.map(schedule => {
                const entry = entries[schedule.id] || { planned: '', actual: '' }
                const hasBoth = entry.planned !== '' && entry.actual !== ''
                const variance = hasBoth ? (entry.actual as number) - (entry.planned as number) : 0
                const varianceColor = variance > 0 ? 'text-green-500' : variance < 0 ? 'text-red-500' : 'text-[#8B9FC4]'
                
                return (
                  <div key={schedule.id} className="flex items-center bg-[#0C1221] border border-white/[0.06] p-5 rounded-[14px] hover:bg-white/[0.04] transition-all duration-150">
                    <div className="w-[180px] shrink-0 pr-4 border-r border-[#243050]/50 mr-6">
                      <p className="text-[16px] font-bold text-[#EEF3FF] tracking-tight truncate" title={schedule.pattern}>{schedule.pattern}</p>
                      <p className="text-[13px] text-[#5A6E90] mt-1 truncate" title={schedule.product}>{schedule.product}</p>
                    </div>

                    <div className="flex flex-1 items-center gap-6">
                      <div className="w-[110px]">
                        <p className="text-[11px] text-[#8B9FC4] uppercase font-semibold mb-2 tracking-widest">Stage</p>
                        <Badge 
                          variant="outline" 
                          onClick={() => setActiveStageScheduleId(schedule.id)}
                          className={cn(
                            getBadgeColor(schedule.stage), 
                            "text-[11px] py-1 px-3 border-opacity-50 cursor-pointer hover:ring-2 hover:ring-offset-1 hover:ring-offset-[#0C1221] transition-all",
                            activeStageScheduleId === schedule.id && "ring-2 ring-offset-1 ring-offset-[#0C1221]"
                          )}
                        >
                          {schedule.stage}
                        </Badge>
                      </div>

                      <div className="w-[100px]">
                        <p className="text-[11px] text-[#8B9FC4] uppercase font-semibold mb-2 tracking-widest">Planned</p>
                        <input 
                          type="number" 
                          min="0"
                          value={entry.planned === '' ? '' : entry.planned}
                          onChange={e => setEntries({...entries, [schedule.id]: {...entry, planned: e.target.value === '' ? '' : parseInt(e.target.value)}})}
                          className="w-full bg-transparent border-b border-[#243050] focus:border-[#D4521A] text-[#EEF3FF] text-[17px] font-bold px-1 py-1 outline-none transition-colors"
                          placeholder="0"
                        />
                      </div>

                      <div className="w-[100px]">
                        <p className="text-[11px] text-[#8B9FC4] uppercase font-semibold mb-2 tracking-widest">Actual</p>
                        <input 
                          type="number" 
                          min="0"
                          value={entry.actual === '' ? '' : entry.actual}
                          onChange={e => setEntries({...entries, [schedule.id]: {...entry, actual: e.target.value === '' ? '' : parseInt(e.target.value)}})}
                          className="w-full bg-transparent border-b border-[#243050] focus:border-green-500 text-[#EEF3FF] text-[17px] font-bold px-1 py-1 outline-none transition-colors"
                          placeholder="0"
                        />
                      </div>

                      <div className="w-[100px] pl-4">
                        <p className="text-[11px] text-[#8B9FC4] uppercase font-semibold mb-2 tracking-widest">Variance</p>
                        <span className={cn("font-mono font-bold text-xl transition-opacity", !hasBoth ? "opacity-30 text-[#5A6E90]" : varianceColor)}>
                          {!hasBoth ? '-' : (variance > 0 ? `+${variance}` : variance)}
                        </span>
                      </div>
                    </div>

                    <div className="ml-auto pl-4 border-l border-[#243050]/50 h-10 flex items-center">
                      <button 
                        onClick={() => onRemove(schedule.id)} 
                        className="text-[#5A6E90] hover:text-red-400 p-2 rounded-full hover:bg-red-400/10 transition-colors ml-2"
                        title="Remove"
                      >
                        <X weight="bold" className="h-5 w-5" />
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* Bottom Sticky Footer */}
      <div className="px-6 py-5 border-t border-[#243050] shrink-0 flex items-center justify-between bg-[#050810] z-10 sticky bottom-0">
        {!showForm ? (
          <Button 
            onClick={() => setShowForm(true)}
            variant="ghost" 
            className="text-[#8B9FC4] hover:text-[#EEF3FF] hover:bg-[#1C2840] h-12 px-6"
          >
            <CalendarPlus weight="duotone" className="mr-2 h-5 w-5" />
            Schedule Order
          </Button>
        ) : (
          <div /> // Spacer if form is open
        )}
        
        <div className="flex gap-3">
          <Button variant="ghost" onClick={handleClose} className="text-[#8B9FC4] hover:text-[#EEF3FF] hover:bg-[#1C2840] h-12 px-6">
            Cancel
          </Button>
          {schedules.length > 0 && (
            <Button 
              onClick={handleSave} 
              disabled={isSaving}
              className="bg-[#D4521A] hover:bg-[#D4521A] text-white h-12 px-8 font-semibold text-[15px] disabled:opacity-50"
            >
              {isSaving ? 'Saving...' : 'Save Entries'}
            </Button>
          )}
        </div>
      </div>
    </div>
    </>,
    document.body
  )
}
