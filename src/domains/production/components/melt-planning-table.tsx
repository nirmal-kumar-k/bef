'use client'

import { useState, useMemo, useEffect } from 'react'
import { Plus, Note, Calculator, FileCsv, DownloadSimple, CalendarPlus } from '@phosphor-icons/react'
import { Button } from '@/shared/ui/button'
import { Input } from '@/shared/ui/input'
import { Label } from '@/shared/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select'
import { Badge } from '@/shared/ui/badge'
import { cn } from '@/shared/lib/utils'

// Configuration
const RECIPES: Record<string, { pigIron: number, scrap: number, feMn: number, carburizer: number }> = {
  'FC 200': { pigIron: 35, scrap: 60, feMn: 2, carburizer: 3 },
  'FC 250': { pigIron: 35, scrap: 60, feMn: 2, carburizer: 3 },
  'FC 300': { pigIron: 35, scrap: 60, feMn: 2, carburizer: 3 },
  'FC 350': { pigIron: 30, scrap: 65, feMn: 2, carburizer: 3 },
  'SG 400': { pigIron: 45, scrap: 47, feMn: 3, carburizer: 5 },
  'SG 500': { pigIron: 45, scrap: 47, feMn: 3, carburizer: 5 },
  'SG 600': { pigIron: 50, scrap: 42, feMn: 3, carburizer: 5 },
}

const RECOVERY = { carburizer: 0.90, feSi75: 0.75, feMn80: 0.80 }
const ALL_GRADES = Object.keys(RECIPES)

interface Heat {
  heatNo: string
  date: string
  day: number
  slot: number
  grade: string
  meltWeight: number
  isLast: boolean
}

interface MeltingNote {
  heatNo: string
  grade: string
  meltWeight: number
  temp: number
  c: number | null
  si: number | null
  mn: number | null
  p: number | null
  s: number | null
  remarks: string
}

export function MeltPlanningTable({ defaultMetalQty, defaultGrade }: { defaultMetalQty: number, defaultGrade?: string }) {
  // Master State
  const [activeSection, setActiveSection] = useState<'heatPlan' | 'datePlan' | 'rawMaterial' | 'meltingNotes' | 'spectro'>('heatPlan')
  const [heats, setHeats] = useState<Heat[]>([])
  const [notes, setNotes] = useState<MeltingNote[]>([])

  // Section 1 Inputs
  const [s1Grade, setS1Grade] = useState<string>(defaultGrade && RECIPES[defaultGrade] ? defaultGrade : 'FC 200')
  const [s1Qty, setS1Qty] = useState<number>(defaultMetalQty || 600)
  const [s1StartDate, setS1StartDate] = useState<string>(new Date().toISOString().split('T')[0])
  const [s1Prefix, setS1Prefix] = useState<string>('H')
  const [s1StartNo, setS1StartNo] = useState<number>(1)
  const [s1Capacity, setS1Capacity] = useState<number>(150)

  // Notes Form State
  const [noteForm, setNoteForm] = useState<Partial<MeltingNote>>({ c: null, si: null, mn: null, p: null, s: null })
  const [noteSelectedHeat, setNoteSelectedHeat] = useState<string>('')

  // Spectro State
  const [spHeat, setSpHeat] = useState<string>('')
  const [spManualHeat, setSpManualHeat] = useState<string>('')
  const [spMeltWeight, setSpMeltWeight] = useState<number>(150)
  const [spCurrent, setSpCurrent] = useState({ c: null as number|null, si: null as number|null, mn: null as number|null })
  const [spTarget, setSpTarget] = useState({ c: null as number|null, si: null as number|null, mn: null as number|null })

  // Section 3 State
  const [rmGrade, setRmGrade] = useState<string>('FC 200')
  const [rmQty, setRmQty] = useState<number>(600)
  const [rmHeatView, setRmHeatView] = useState<string>('all')

  // Sync prop changes
  useEffect(() => {
    if (defaultMetalQty !== undefined) {
      setS1Qty(defaultMetalQty)
    }
  }, [defaultMetalQty])

  // --- AUTO CALCULATE HEAT PLAN ---
  useEffect(() => {
    const totalHeats = Math.ceil(s1Qty / s1Capacity)
    const newHeats: Heat[] = []
    let currentDay = 1
    let slot = 1
    
    for (let i = 0; i < totalHeats; i++) {
      const isLast = i === totalHeats - 1
      const lastHeatQty = s1Qty % s1Capacity
      const meltWeight = (isLast && lastHeatQty !== 0) ? lastHeatQty : s1Capacity
      
      const heatNo = `${s1Prefix.toUpperCase()}${(s1StartNo + i).toString().padStart(3, '0')}`
      
      const heatDate = new Date(s1StartDate)
      heatDate.setDate(heatDate.getDate() + currentDay - 1)
      
      newHeats.push({
        heatNo,
        date: heatDate.toISOString().split('T')[0],
        day: currentDay,
        slot,
        grade: s1Grade,
        meltWeight,
        isLast
      })
      
      slot++
      if (slot > 8) {
        slot = 1
        currentDay++
      }
    }
    setHeats(newHeats)
    
    // Auto-sync RM calculator
    setRmGrade(s1Grade)
    setRmQty(s1Qty)
  }, [s1Qty, s1Capacity, s1Grade, s1StartDate, s1Prefix, s1StartNo])

  const exportCSV = () => {
    if (!heats.length) return
    const headers = ["Heat No", "Date", "Day", "Slot", "Grade", "Melt Wt (kg)", "Pig Iron %", "Scrap %", "FeMn %", "Carburizer %", "Pig Iron kg", "Scrap kg", "FeMn kg", "Carburizer kg", "Note Status"]
    const rows = heats.map(h => {
      const rec = RECIPES[h.grade] || RECIPES['FC 200']
      const hasNote = notes.some(n => n.heatNo === h.heatNo)
      return [
        h.heatNo, h.date, h.day, h.slot, h.grade, h.meltWeight,
        rec.pigIron, rec.scrap, rec.feMn, rec.carburizer,
        (h.meltWeight * rec.pigIron / 100).toFixed(2),
        (h.meltWeight * rec.scrap / 100).toFixed(2),
        (h.meltWeight * rec.feMn / 100).toFixed(2),
        (h.meltWeight * rec.carburizer / 100).toFixed(2),
        hasNote ? "Recorded" : "Pending"
      ].join(',')
    })
    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(','), ...rows].join('\n')
    const encodedUri = encodeURI(csvContent)
    const link = document.createElement("a")
    link.setAttribute("href", encodedUri)
    link.setAttribute("download", "heat_plan.csv")
    document.body.appendChild(link)
    link.click()
    link.remove()
  }

  const daysGrouped = useMemo(() => {
    const map = new Map<number, Heat[]>()
    heats.forEach(h => {
      if (!map.has(h.day)) map.set(h.day, [])
      map.get(h.day)!.push(h)
    })
    return Array.from(map.entries()).sort(([a], [b]) => a - b)
  }, [heats])

  // --- SAVE NOTE ---
  const handleSaveNote = () => {
    const heatNo = noteForm.heatNo || noteSelectedHeat
    if (!heatNo) return
    
    const existingIdx = notes.findIndex(n => n.heatNo === heatNo)
    const newNote = {
      ...noteForm,
      heatNo,
      grade: noteForm.grade || s1Grade,
      meltWeight: noteForm.meltWeight || s1Capacity,
      temp: noteForm.temp || 0,
      c: noteForm.c ?? null, si: noteForm.si ?? null, mn: noteForm.mn ?? null, 
      p: noteForm.p ?? null, s: noteForm.s ?? null, remarks: noteForm.remarks || ''
    } as MeltingNote

    if (existingIdx > -1) {
      const updated = [...notes]
      updated[existingIdx] = newNote
      setNotes(updated)
    } else {
      setNotes([...notes, newNote])
    }
    setNoteForm({ c: null, si: null, mn: null, p: null, s: null })
    setNoteSelectedHeat('')
  }

  const handleEditNote = (n: MeltingNote) => {
    setNoteSelectedHeat(heats.some(h => h.heatNo === n.heatNo) ? n.heatNo : '')
    setNoteForm(n)
    setActiveSection('meltingNotes')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  // --- SPECTRO CALCULATION ---
  const spDeficitC = spTarget.c !== null && spCurrent.c !== null ? spTarget.c - spCurrent.c : 0
  const spDeficitSi = spTarget.si !== null && spCurrent.si !== null ? spTarget.si - spCurrent.si : 0
  const spDeficitMn = spTarget.mn !== null && spCurrent.mn !== null ? spTarget.mn - spCurrent.mn : 0

  const spReqC = spDeficitC > 0 ? (spDeficitC * spMeltWeight) / 100 : 0
  const spReqSi = spDeficitSi > 0 ? (spDeficitSi * spMeltWeight) / 100 : 0
  const spReqMn = spDeficitMn > 0 ? (spDeficitMn * spMeltWeight) / 100 : 0

  const spAddC = spReqC / RECOVERY.carburizer
  const spAddSi = spReqSi / RECOVERY.feSi75
  const spAddMn = spReqMn / RECOVERY.feMn80

  const handleSpectroHeatSelect = (hNo: string) => {
    setSpHeat(hNo)
    const h = heats.find(x => x.heatNo === hNo)
    if (h) setSpMeltWeight(h.meltWeight)
    const n = notes.find(x => x.heatNo === hNo)
    if (n) {
      setSpCurrent({ c: n.c, si: n.si, mn: n.mn })
    }
  }

  // Section Navigation
  const NavButton = ({ id, label, icon: Icon }: { id: typeof activeSection, label: string, icon: any }) => (
    <button
      onClick={() => setActiveSection(id)}
      className={cn("flex items-center gap-2 px-4 py-3 border-b-2 font-semibold text-sm transition-colors", 
        activeSection === id ? "border-[#D4521A] text-[#D4521A]" : "border-transparent text-[#8B9FC4] hover:text-[#EEF3FF]"
      )}
    >
      <Icon weight={activeSection === id ? "bold" : "duotone"} className="w-4 h-4" />
      {label}
    </button>
  )

  return (
    <div className="space-y-6">
      
      {/* Sub-Navigation */}
      <div className="flex flex-wrap gap-2 border-b border-[#243050] bg-[#050810] px-4 pt-2 rounded-t-xl">
        <NavButton id="heatPlan" label="1. Heat Plan" icon={CalendarPlus} />
        <NavButton id="datePlan" label="2. Date-wise View" icon={CalendarPlus} />
        <NavButton id="rawMaterial" label="3. RM Calculator" icon={Calculator} />
        <NavButton id="meltingNotes" label="4. Melting Notes" icon={Note} />
        <NavButton id="spectro" label="5. Spectro Correction" icon={Calculator} />
      </div>

      {/* SECTION 1: HEAT PLAN */}
      {activeSection === 'heatPlan' && (
        <div className="space-y-6">
          <div className="bg-[#0C1221] p-6 rounded-xl border border-[#243050]">
            <h3 className="text-[#EEF3FF] font-bold mb-1">Generate Heat Plan</h3>
            <p className="text-[#8B9FC4] text-xs mb-6 font-mono">Crucible: 150 kg/heat · 1 heat = 1 hr · 8 heats/day · Auto heat numbering with prefix</p>
            
            <div className="grid grid-cols-1 md:grid-cols-6 gap-4 items-end">
              <div>
                <Label className="text-[#8B9FC4] text-xs mb-1 block">Grade</Label>
                <Select value={s1Grade} onValueChange={setS1Grade}>
                  <SelectTrigger className="bg-[#050810] border-[#243050] text-[#EEF3FF]"><SelectValue /></SelectTrigger>
                  <SelectContent className="bg-[#0C1221] border-[#243050] text-[#EEF3FF]">
                    {ALL_GRADES.map(g => <SelectItem key={g} value={g}>{g}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-[#8B9FC4] text-xs mb-1 block">Required Metal (kg)</Label>
                <Input type="number" value={s1Qty} onChange={e => setS1Qty(Number(e.target.value))} className="bg-[#050810] border-[#243050] text-[#EEF3FF]" />
              </div>
              <div>
                <Label className="text-[#8B9FC4] text-xs mb-1 block">Start Date</Label>
                <Input type="date" value={s1StartDate} onChange={e => setS1StartDate(e.target.value)} className="bg-[#050810] border-[#243050] text-[#EEF3FF]" />
              </div>
              <div>
                <Label className="text-[#8B9FC4] text-xs mb-1 block">Heat Prefix</Label>
                <Input value={s1Prefix} maxLength={4} onChange={e => setS1Prefix(e.target.value.toUpperCase())} className="bg-[#050810] border-[#243050] text-[#EEF3FF] uppercase" />
              </div>
              <div>
                <Label className="text-[#8B9FC4] text-xs mb-1 block">Start Heat No</Label>
                <Input type="number" value={s1StartNo} onChange={e => setS1StartNo(Number(e.target.value))} className="bg-[#050810] border-[#243050] text-[#EEF3FF]" />
              </div>
              <div>
                <Label className="text-[#8B9FC4] text-xs mb-1 block">Crucible (kg)</Label>
                <Input type="number" value={s1Capacity} onChange={e => setS1Capacity(Number(e.target.value))} className="bg-[#050810] border-[#243050] text-[#EEF3FF]" />
              </div>
            </div>
            
            <div className="mt-6 flex gap-3">
              {heats.length > 0 && <Button onClick={exportCSV} variant="outline" className="border-[#243050] text-[#8B9FC4] hover:text-[#EEF3FF] hover:bg-[#1A263D]"><FileCsv className="w-4 h-4 mr-2"/> Export CSV</Button>}
            </div>
          </div>

          {heats.length > 0 && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 md:grid-cols-6 gap-4 bg-[#050810] border border-[#243050] p-4 rounded-xl">
                <div><p className="text-[10px] uppercase text-[#8B9FC4]">Total Heats</p><p className="font-mono text-[#EEF3FF] text-lg font-bold">{heats.length}</p></div>
                <div><p className="text-[10px] uppercase text-[#8B9FC4]">Working Days</p><p className="font-mono text-[#EEF3FF] text-lg font-bold">{daysGrouped.length}</p></div>
                <div><p className="text-[10px] uppercase text-[#8B9FC4]">Total Order (kg)</p><p className="font-mono text-[#D4521A] text-lg font-bold">{s1Qty}</p></div>
                <div><p className="text-[10px] uppercase text-[#8B9FC4]">Crucible Size</p><p className="font-mono text-[#EEF3FF] text-lg font-bold">{s1Capacity} kg</p></div>
                <div><p className="text-[10px] uppercase text-[#8B9FC4]">Last Heat Qty</p><p className="font-mono text-[#EEF3FF] text-lg font-bold">{s1Qty % s1Capacity === 0 ? s1Capacity : s1Qty % s1Capacity} kg</p></div>
                <div><p className="text-[10px] uppercase text-[#8B9FC4]">Schedule</p><p className="font-mono text-[#EEF3FF] text-sm mt-1">{heats[0].date} to {heats[heats.length-1].date}</p></div>
              </div>

              {daysGrouped.map(([day, dayHeats]) => {
                const dayKg = dayHeats.reduce((sum, h) => sum + h.meltWeight, 0)
                const rec = RECIPES[s1Grade]
                return (
                  <div key={day} className="border border-[#243050] rounded-xl overflow-hidden">
                    <div className="bg-[#0C1221] px-4 py-3 flex justify-between items-center border-b border-[#243050]">
                      <h4 className="font-bold text-[#EEF3FF] font-mono tracking-tight">DAY {day} — {dayHeats[0].date}</h4>
                      <div className="flex gap-4 text-xs font-mono">
                        <span className="text-[#8B9FC4]">Pig Iron: <span className="text-[#EEF3FF]">{(dayKg * rec.pigIron / 100).toFixed(1)}kg ({rec.pigIron}%)</span></span>
                        <span className="text-[#8B9FC4]">Scrap: <span className="text-[#EEF3FF]">{(dayKg * rec.scrap / 100).toFixed(1)}kg ({rec.scrap}%)</span></span>
                        <span className="text-[#8B9FC4]">FeMn: <span className="text-[#EEF3FF]">{(dayKg * rec.feMn / 100).toFixed(1)}kg ({rec.feMn}%)</span></span>
                        <span className="text-[#8B9FC4]">Carburizer: <span className="text-[#EEF3FF]">{(dayKg * rec.carburizer / 100).toFixed(1)}kg ({rec.carburizer}%)</span></span>
                      </div>
                    </div>
                    <table className="w-full text-sm text-left bg-[#050810]">
                      <thead className="text-[#8B9FC4] text-xs uppercase bg-[#1A263D]/30">
                        <tr>
                          <th className="px-4 py-2">Heat No.</th>
                          <th className="px-4 py-2">Slot</th>
                          <th className="px-4 py-2">Grade</th>
                          <th className="px-4 py-2 text-center">Melt Wt (kg)</th>
                          <th className="px-4 py-2 text-center">Load</th>
                          <th className="px-4 py-2 text-right">Note Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#243050]">
                        {dayHeats.map(h => {
                          const hasNote = notes.some(n => n.heatNo === h.heatNo)
                          return (
                            <tr key={h.heatNo} className="hover:bg-[#1A263D]/50 transition-colors">
                              <td className="px-4 py-2 font-bold font-mono text-[#EEF3FF]">{h.heatNo}</td>
                              <td className="px-4 py-2 text-[#8B9FC4]">Slot {h.slot}</td>
                              <td className="px-4 py-2 text-[#C4D2EE]">{h.grade}</td>
                              <td className="px-4 py-2 font-mono text-[#D4521A] text-center">{h.meltWeight}</td>
                              <td className="px-4 py-2 text-center">
                                {h.isLast && h.meltWeight < s1Capacity ? 
                                  <Badge variant="outline" className="text-yellow-500 border-yellow-500/30">Partial</Badge> : 
                                  <Badge variant="outline" className="text-blue-400 border-blue-400/30">Full</Badge>
                                }
                              </td>
                              <td className="px-4 py-2 text-right">
                                {hasNote ? (
                                  <Badge className="bg-green-500/20 text-green-400 border-green-500/30">Recorded</Badge>
                                ) : (
                                  <Button 
                                    variant="ghost" 
                                    size="sm" 
                                    className="h-7 text-xs text-[#8B9FC4] hover:text-[#D4521A]"
                                    onClick={() => {
                                      setNoteSelectedHeat(h.heatNo)
                                      setNoteForm({ grade: h.grade, meltWeight: h.meltWeight })
                                      setActiveSection('meltingNotes')
                                    }}
                                  >
                                    + Add Note
                                  </Button>
                                )}
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* SECTION 2: DATE-WISE PLAN VIEW */}
      {activeSection === 'datePlan' && (
        <div className="space-y-6">
          {!heats.length ? (
            <div className="text-center py-12 text-[#8B9FC4]">Run Heat Plan first to view date-wise aggregation.</div>
          ) : (
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
              {daysGrouped.map(([day, dayHeats]) => {
                const dayKg = dayHeats.reduce((sum, h) => sum + h.meltWeight, 0)
                const rec = RECIPES[s1Grade]
                const recordedCount = dayHeats.filter(h => notes.some(n => n.heatNo === h.heatNo)).length
                const pct = (recordedCount / dayHeats.length) * 100
                
                return (
                  <div key={day} className="bg-[#0C1221] border border-[#243050] rounded-xl overflow-hidden flex flex-col">
                    <div className="p-4 border-b border-[#243050] flex justify-between items-center">
                      <div>
                        <h4 className="font-bold text-[#EEF3FF] text-lg font-mono">{dayHeats[0].date}</h4>
                        <p className="text-xs text-[#8B9FC4]">Day {day} • {dayHeats.length} Heats • {dayKg} kg</p>
                      </div>
                      <div className="text-right">
                        <div className="flex items-center justify-end gap-2 mb-2">
                          <Badge className="bg-[#1A263D] text-[#8B9FC4] border-transparent">{recordedCount} Recorded</Badge>
                          <Badge className="bg-amber-500/10 text-amber-500 border-transparent">{dayHeats.length - recordedCount} Pending</Badge>
                        </div>
                        <div className="w-32 h-1.5 bg-[#1A263D] rounded-full overflow-hidden">
                          <div className={cn("h-full", pct === 100 ? "bg-green-500" : "bg-amber-500")} style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    </div>
                    <div className="p-4 bg-[#050810] flex-1">
                       <table className="w-full text-xs text-left">
                        <thead className="text-[#5A6E90] uppercase border-b border-[#243050]">
                          <tr>
                            <th className="py-1 text-center">Heat</th>
                            <th className="py-1 text-center">Slot</th>
                            <th className="py-1 text-center">Wt (kg)</th>
                            <th className="py-1 text-center">Pig Iron</th>
                            <th className="py-1 text-center">Scrap</th>
                            <th className="py-1 text-center">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#243050]/50">
                          {dayHeats.map(h => {
                            const hasNote = notes.some(n => n.heatNo === h.heatNo)
                            return (
                              <tr key={h.heatNo}>
                                <td className="py-2 font-mono text-[#EEF3FF] text-center">{h.heatNo}</td>
                                <td className="py-2 text-[#8B9FC4] text-center">{h.slot}</td>
                                <td className="py-2 font-mono text-[#D4521A] text-center">{h.meltWeight}</td>
                                <td className="py-2 text-[#8B9FC4] text-center">{(h.meltWeight * rec.pigIron / 100).toFixed(1)}</td>
                                <td className="py-2 text-[#8B9FC4] text-center">{(h.meltWeight * rec.scrap / 100).toFixed(1)}</td>
                                <td className="py-2 text-center flex justify-center mt-1">
                                  {hasNote ? <CheckBadge /> : <PendingBadge />}
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                       </table>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* SECTION 3: RM CALCULATOR */}
      {activeSection === 'rawMaterial' && (
        <div className="space-y-6">
          <div className="bg-[#0C1221] p-6 rounded-xl border border-[#243050]">
            <div className="flex justify-between items-start mb-6">
              <div>
                <h3 className="text-[#EEF3FF] font-bold">Raw Material Calculator</h3>
                <p className="text-[#8B9FC4] text-xs">Estimate full order or single heat material requirements.</p>
              </div>
              {heats.length > 0 && (
                <Button variant="outline" onClick={() => { setRmGrade(s1Grade); setRmQty(s1Qty); setRmHeatView('all'); }} className="border-[#243050] text-[#8B9FC4]">
                  Sync Grade & Qty from Plan
                </Button>
              )}
            </div>

            <div className="flex flex-wrap items-end gap-12">
              <div className="flex flex-col items-center">
                <Label className="text-[#8B9FC4] text-xs mb-1 block text-center">Grade</Label>
                <Select value={rmGrade} onValueChange={setRmGrade}>
                  <SelectTrigger className="w-24 bg-[#050810] border-[#243050] text-[#EEF3FF]"><SelectValue className="text-center justify-center" /></SelectTrigger>
                  <SelectContent className="bg-[#0C1221] border-[#243050] text-[#EEF3FF]">
                    {ALL_GRADES.map(g => <SelectItem key={g} value={g}>{g}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col items-center">
                <Label className="text-[#8B9FC4] text-xs mb-1 block text-center">Required Qty</Label>
                <Input type="number" value={rmQty} onChange={e => setRmQty(Number(e.target.value))} className="w-24 text-center bg-[#050810] border-[#243050] text-[#EEF3FF] [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" disabled={rmHeatView !== 'all'} />
              </div>
              <div className="flex flex-col items-center">
                <Label className="text-[#8B9FC4] text-xs mb-1 block text-center">Specific Heat</Label>
                <Select value={rmHeatView} onValueChange={(v) => { 
                  setRmHeatView(v)
                  if(v !== 'all') {
                    const h = heats.find(x => x.heatNo === v)
                    if (h) { setRmQty(h.meltWeight); setRmGrade(h.grade); }
                  }
                }}>
                  <SelectTrigger className="w-20 bg-[#050810] border-[#243050] text-[#EEF3FF]"><SelectValue className="text-center justify-center" /></SelectTrigger>
                  <SelectContent className="bg-[#0C1221] border-[#243050] text-[#EEF3FF]">
                    <SelectItem value="all">All</SelectItem>
                    {heats.map(h => <SelectItem key={h.heatNo} value={h.heatNo}>{h.heatNo}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <div className="bg-[#050810] border border-[#243050] rounded-xl overflow-hidden">
            {(() => {
              const rec = RECIPES[rmGrade]
              if (!rec) return <div className="p-4 text-white">Select valid grade.</div>
              return (
                <table className="w-full text-sm text-left">
                  <thead className="text-[#8B9FC4] text-xs uppercase bg-[#1A263D]/30 border-b border-[#243050]">
                    <tr>
                      <th className="px-6 py-4">Material</th>
                      <th className="px-6 py-4 text-center">Percentage</th>
                      <th className="px-6 py-4 text-center">Required (kg)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#243050]">
                    <tr>
                      <td className="px-6 py-4 font-medium text-[#EEF3FF]">Pig Iron</td>
                      <td className="px-6 py-4 text-center text-[#8B9FC4]">{rec.pigIron}%</td>
                      <td className="px-6 py-4 text-center font-mono text-[#D4521A]">{(rmQty * rec.pigIron / 100).toFixed(1)}</td>
                    </tr>
                    <tr>
                      <td className="px-6 py-4 font-medium text-[#EEF3FF]">Scrap</td>
                      <td className="px-6 py-4 text-center text-[#8B9FC4]">{rec.scrap}%</td>
                      <td className="px-6 py-4 text-center font-mono text-[#D4521A]">{(rmQty * rec.scrap / 100).toFixed(1)}</td>
                    </tr>
                    <tr>
                      <td className="px-6 py-4 font-medium text-[#EEF3FF]">FeMn</td>
                      <td className="px-6 py-4 text-center text-[#8B9FC4]">{rec.feMn}%</td>
                      <td className="px-6 py-4 text-center font-mono text-[#D4521A]">{(rmQty * rec.feMn / 100).toFixed(1)}</td>
                    </tr>
                    <tr>
                      <td className="px-6 py-4 font-medium text-[#EEF3FF]">Carburizer</td>
                      <td className="px-6 py-4 text-center text-[#8B9FC4]">{rec.carburizer}%</td>
                      <td className="px-6 py-4 text-center font-mono text-[#D4521A]">{(rmQty * rec.carburizer / 100).toFixed(1)}</td>
                    </tr>
                  </tbody>
                  <tfoot className="bg-[#0C1221] border-t border-[#243050]">
                    <tr>
                      <td className="px-6 py-4 font-bold text-[#EEF3FF]">GRAND TOTAL</td>
                      <td className="px-6 py-4 text-center font-bold text-[#EEF3FF]">100%</td>
                      <td className="px-6 py-4 text-center font-mono font-bold text-[#D4521A] text-lg">{rmQty.toFixed(1)}</td>
                    </tr>
                  </tfoot>
                </table>
              )
            })()}
          </div>
          
          {rmHeatView !== 'all' && (
            <div className="flex justify-end mt-4">
              {notes.some(n => n.heatNo === rmHeatView) ? (
                <Badge className="bg-green-500/20 text-green-400 border-green-500/30 px-4 py-2">
                  Melting Note Recorded
                </Badge>
              ) : (
                <Button 
                  onClick={() => {
                    setNoteSelectedHeat(rmHeatView)
                    setNoteForm({ grade: rmGrade, meltWeight: rmQty })
                    setActiveSection('meltingNotes')
                  }}
                  className="bg-[#1A263D] hover:bg-[#2E3C5C] text-[#EEF3FF]"
                >
                  + Add Melting Note for {rmHeatView}
                </Button>
              )}
            </div>
          )}
        </div>
      )}

      {/* SECTION 4: MELTING NOTES */}
      {activeSection === 'meltingNotes' && (
        <div className="space-y-8 pt-4">
          <div className="flex flex-col md:flex-row md:items-center gap-6 md:gap-10 px-2">
             <p className="text-[#8B9FC4] text-sm font-mono max-w-2xl leading-relaxed">
                Record heat-wise observations.<br/>
                Linked to planned heats for full traceability.
             </p>
             {heats.length > 0 && (
               <div className="flex gap-8 md:border-l border-[#243050] md:pl-10">
                 <div><p className="text-[10px] text-[#5A6E90] font-bold uppercase tracking-widest mb-2">Planned</p><p className="font-bold text-[#EEF3FF] text-3xl leading-none">{heats.length}</p></div>
                 <div><p className="text-[10px] text-[#5A6E90] font-bold uppercase tracking-widest mb-2">Recorded</p><p className="font-bold text-[#4285F4] text-3xl leading-none">{notes.length}</p></div>
                 <div><p className="text-[10px] text-[#5A6E90] font-bold uppercase tracking-widest mb-2">Pending</p><p className="font-bold text-amber-500 text-3xl leading-none">{heats.length - notes.length}</p></div>
               </div>
             )}
          </div>

          <div className="bg-[#0C1221] border border-[#243050] rounded-xl p-6">
            <h4 className="font-bold text-[#EEF3FF] text-lg mb-8 tracking-tight">Add / Edit Melting Note</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              <div>
                <Label className="text-[#8B9FC4] text-xs mb-2 block font-medium">Planned Heat Link (Optional)</Label>
                <Select value={noteSelectedHeat} onValueChange={(v) => {
                  if (v === 'none') {
                    setNoteSelectedHeat('')
                  } else {
                    setNoteSelectedHeat(v)
                    const h = heats.find(x => x.heatNo === v)
                    if (h) setNoteForm(prev => ({...prev, grade: h.grade, meltWeight: h.meltWeight}))
                  }
                }}>
                  <SelectTrigger className="w-full bg-[#050810] border-[#243050] text-[#EEF3FF] h-10"><SelectValue placeholder="Select from plan..."/></SelectTrigger>
                  <SelectContent className="bg-[#0C1221] border-[#243050] text-[#EEF3FF]">
                    <SelectItem value="none">-- Manual Entry --</SelectItem>
                    {heats.map(h => <SelectItem key={h.heatNo} value={h.heatNo}>{h.heatNo} - {h.grade} - {h.meltWeight}kg</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-[#8B9FC4] text-xs mb-2 block font-medium">Heat No (Manual)</Label>
                <Input value={noteForm.heatNo || ''} onChange={e => setNoteForm({...noteForm, heatNo: e.target.value})} placeholder="Or type manually..." className="w-full bg-[#050810] border-[#243050] text-[#EEF3FF] h-10" disabled={!!noteSelectedHeat} />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6 pb-6 border-b border-[#243050]">
              <div>
                <Label className="text-[#8B9FC4] text-xs mb-2 block font-medium">Grade</Label>
                <Select value={noteForm.grade || ''} onValueChange={v => setNoteForm({...noteForm, grade: v})}>
                  <SelectTrigger className="w-full bg-[#050810] border-[#243050] text-[#EEF3FF] h-10">
                    <SelectValue placeholder="Select Grade" />
                  </SelectTrigger>
                  <SelectContent className="bg-[#0C1221] border-[#243050] text-[#EEF3FF]">
                    {ALL_GRADES.map(g => <SelectItem key={g} value={g}>{g}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-[#8B9FC4] text-xs mb-2 block font-medium">Melt Weight (kg)</Label>
                <Input type="number" value={noteForm.meltWeight || ''} onChange={e => setNoteForm({...noteForm, meltWeight: Number(e.target.value)})} className="w-full bg-[#050810] border-[#243050] text-[#EEF3FF] h-10" placeholder="e.g. 500" />
              </div>
              <div>
                <Label className="text-[#8B9FC4] text-xs mb-2 block font-medium">Temperature (°C)</Label>
                <Input type="number" value={noteForm.temp || ''} onChange={e => setNoteForm({...noteForm, temp: Number(e.target.value)})} className="w-full bg-[#050810] border-[#243050] text-[#EEF3FF] h-10" placeholder="e.g. 1650" />
              </div>
            </div>

            <h5 className="text-[#5A6E90] text-[11px] font-bold tracking-widest uppercase mb-4">Composition (%)</h5>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
              <div>
                <Label className="text-[#8B9FC4] text-xs mb-2 block font-medium">Carbon (C)</Label>
                <Input type="number" step={0.01} value={noteForm.c ?? ''} onChange={e => setNoteForm({...noteForm, c: e.target.value ? Number(e.target.value) : null})} className="w-full bg-[#050810] border-[#243050] text-[#EEF3FF] font-mono h-10 text-center [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" placeholder="0.00" />
              </div>
              <div>
                <Label className="text-[#8B9FC4] text-xs mb-2 block font-medium">Silicon (Si)</Label>
                <Input type="number" step={0.01} value={noteForm.si ?? ''} onChange={e => setNoteForm({...noteForm, si: e.target.value ? Number(e.target.value) : null})} className="w-full bg-[#050810] border-[#243050] text-[#EEF3FF] font-mono h-10 text-center [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" placeholder="0.00" />
              </div>
              <div>
                <Label className="text-[#8B9FC4] text-xs mb-2 block font-medium">Manganese (Mn)</Label>
                <Input type="number" step={0.01} value={noteForm.mn ?? ''} onChange={e => setNoteForm({...noteForm, mn: e.target.value ? Number(e.target.value) : null})} className="w-full bg-[#050810] border-[#243050] text-[#EEF3FF] font-mono h-10 text-center [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" placeholder="0.00" />
              </div>
              <div>
                <Label className="text-[#8B9FC4] text-xs mb-2 block font-medium">Phosphorus (P)</Label>
                <Input type="number" step={0.001} value={noteForm.p ?? ''} onChange={e => setNoteForm({...noteForm, p: e.target.value ? Number(e.target.value) : null})} className="w-full bg-[#050810] border-[#243050] text-[#EEF3FF] font-mono h-10 text-center [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" placeholder="0.000" />
              </div>
              <div>
                <Label className="text-[#8B9FC4] text-xs mb-2 block font-medium">Sulphur (S)</Label>
                <Input type="number" step={0.001} value={noteForm.s ?? ''} onChange={e => setNoteForm({...noteForm, s: e.target.value ? Number(e.target.value) : null})} className="w-full bg-[#050810] border-[#243050] text-[#EEF3FF] font-mono h-10 text-center [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" placeholder="0.000" />
              </div>
            </div>
            
            <div className="mb-6">
              <Label className="text-[#8B9FC4] text-xs mb-2 block font-medium">Remarks</Label>
              <Input value={noteForm.remarks || ''} onChange={e => setNoteForm({...noteForm, remarks: e.target.value})} className="w-full bg-[#050810] border-[#243050] text-[#EEF3FF] h-10" placeholder="Any additional observations..." />
            </div>

            <div className="flex gap-3">
              <Button onClick={handleSaveNote} disabled={!noteForm.heatNo && !noteSelectedHeat} className="bg-[#D4521A] hover:bg-[#D4521A]/90 text-white font-semibold px-8">Save Note</Button>
              <Button onClick={() => {setNoteForm({ c: null, si: null, mn: null, p: null, s: null }); setNoteSelectedHeat('')}} variant="outline" className="border-[#243050] text-[#8B9FC4]">Clear</Button>
            </div>
          </div>

          {notes.length > 0 && (
             <div className="border border-[#243050] rounded-xl overflow-hidden overflow-x-auto bg-[#050810]">
               <table className="w-full text-xs text-left whitespace-nowrap">
                  <thead className="bg-[#0C1221] border-b border-[#243050] text-[#8B9FC4] uppercase tracking-wider font-semibold">
                    <tr>
                      <th className="px-4 py-3">Heat No</th>
                      <th className="px-4 py-3">Grade / Wt</th>
                      <th className="px-4 py-3">Temp</th>
                      <th className="px-4 py-3 text-center border-l border-[#243050]">C</th>
                      <th className="px-4 py-3 text-center border-l border-[#243050]">Si</th>
                      <th className="px-4 py-3 text-center border-l border-[#243050]">Mn</th>
                      <th className="px-4 py-3 text-center border-l border-[#243050]">P</th>
                      <th className="px-4 py-3 text-center border-l border-[#243050]">S</th>
                      <th className="px-4 py-3">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#243050]">
                    {notes.map(n => {
                      const kgC = n.c !== null ? ((n.c * n.meltWeight)/100).toFixed(2) : '—'
                      const kgSi = n.si !== null ? ((n.si * n.meltWeight)/100).toFixed(2) : '—'
                      const kgMn = n.mn !== null ? ((n.mn * n.meltWeight)/100).toFixed(2) : '—'
                      const kgP = n.p !== null ? ((n.p * n.meltWeight)/100).toFixed(3) : '—'
                      const kgS = n.s !== null ? ((n.s * n.meltWeight)/100).toFixed(3) : '—'
                      return (
                        <tr key={n.heatNo} className="hover:bg-[#1A263D]/30">
                          <td className="px-4 py-3 font-bold text-[#EEF3FF] font-mono">{n.heatNo}</td>
                          <td className="px-4 py-3 text-[#C4D2EE]">{n.grade} <span className="text-[#8B9FC4]">| {n.meltWeight}kg</span></td>
                          <td className="px-4 py-3 font-mono text-[#D4521A]">{n.temp ? `${n.temp}°C` : '—'}</td>
                          <td className="px-4 py-2 text-center border-l border-[#243050]">
                            <p className="font-bold text-[#EEF3FF]">{n.c !== null ? `${n.c}%` : '—'}</p>
                            <p className="text-[10px] text-[#4285F4]">{kgC} kg</p>
                          </td>
                          <td className="px-4 py-2 text-center border-l border-[#243050]">
                            <p className="font-bold text-[#EEF3FF]">{n.si !== null ? `${n.si}%` : '—'}</p>
                            <p className="text-[10px] text-[#4285F4]">{kgSi} kg</p>
                          </td>
                          <td className="px-4 py-2 text-center border-l border-[#243050]">
                            <p className="font-bold text-[#EEF3FF]">{n.mn !== null ? `${n.mn}%` : '—'}</p>
                            <p className="text-[10px] text-[#4285F4]">{kgMn} kg</p>
                          </td>
                          <td className="px-4 py-2 text-center border-l border-[#243050]">
                            <p className="font-bold text-[#EEF3FF]">{n.p !== null ? `${n.p}%` : '—'}</p>
                            <p className="text-[10px] text-[#4285F4]">{kgP} kg</p>
                          </td>
                          <td className="px-4 py-2 text-center border-l border-[#243050]">
                            <p className="font-bold text-[#EEF3FF]">{n.s !== null ? `${n.s}%` : '—'}</p>
                            <p className="text-[10px] text-[#4285F4]">{kgS} kg</p>
                          </td>
                          <td className="px-4 py-3">
                            <Button variant="ghost" size="sm" onClick={() => handleEditNote(n)} className="h-7 text-xs text-[#8B9FC4] hover:text-[#EEF3FF]">Edit</Button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
               </table>
             </div>
          )}
        </div>
      )}

      {/* SECTION 5: SPECTRO CORRECTION */}
      {activeSection === 'spectro' && (
        <div className="space-y-6">
           <div className="bg-[#0C1221] border border-[#243050] rounded-xl p-6">
             <h4 className="font-bold text-[#EEF3FF] mb-1">Spectro Correction Calculator</h4>
             <p className="text-[#8B9FC4] text-xs mb-6 font-mono">Enter spectro readings to get recommended additions based on target grades.</p>

             <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6 pb-6 border-b border-[#243050]">
               <div className="md:col-span-2">
                 <Label className="text-[#8B9FC4] text-xs mb-1 block">Planned Heat (Auto-fills if note exists)</Label>
                 <Select value={spHeat} onValueChange={handleSpectroHeatSelect}>
                   <SelectTrigger className="bg-[#050810] border-[#243050] text-[#EEF3FF]"><SelectValue placeholder="Select..."/></SelectTrigger>
                   <SelectContent className="bg-[#0C1221] border-[#243050] text-[#EEF3FF]">
                     {heats.map(h => <SelectItem key={h.heatNo} value={h.heatNo}>{h.heatNo}</SelectItem>)}
                   </SelectContent>
                 </Select>
               </div>
               <div>
                 <Label className="text-[#8B9FC4] text-xs mb-1 block">Manual Heat No</Label>
                 <Input value={spManualHeat} onChange={e => setSpManualHeat(e.target.value)} placeholder="e.g. H001" className="bg-[#050810] border-[#243050] text-[#EEF3FF]" disabled={!!spHeat}/>
               </div>
               <div>
                 <Label className="text-[#8B9FC4] text-xs mb-1 block">Melt Weight (kg)</Label>
                 <Input type="number" value={spMeltWeight} onChange={e => setSpMeltWeight(Number(e.target.value))} className="bg-[#050810] border-[#243050] text-[#EEF3FF]" />
               </div>
             </div>

             <div className="grid grid-cols-3 gap-6 mb-6">
                <div>
                  <h5 className="text-[#EEF3FF] font-bold text-sm mb-3">Carbon (C)</h5>
                  <div className="space-y-3">
                    <div>
                      <Label className="text-[#8B9FC4] text-[10px] uppercase">Current %</Label>
                      <Input type="number" step={0.01} value={spCurrent.c ?? ''} onChange={e => setSpCurrent({...spCurrent, c: e.target.value ? Number(e.target.value) : null})} className="bg-[#050810] border-[#243050] text-[#EEF3FF] font-mono h-8" />
                    </div>
                    <div>
                      <Label className="text-[#8B9FC4] text-[10px] uppercase">Target %</Label>
                      <Input type="number" step={0.01} value={spTarget.c ?? ''} onChange={e => setSpTarget({...spTarget, c: e.target.value ? Number(e.target.value) : null})} className="bg-[#050810] border-[#243050] text-[#EEF3FF] font-mono h-8" />
                    </div>
                  </div>
                </div>
                <div>
                  <h5 className="text-[#EEF3FF] font-bold text-sm mb-3">Silicon (Si)</h5>
                  <div className="space-y-3">
                    <div>
                      <Label className="text-[#8B9FC4] text-[10px] uppercase">Current %</Label>
                      <Input type="number" step={0.01} value={spCurrent.si ?? ''} onChange={e => setSpCurrent({...spCurrent, si: e.target.value ? Number(e.target.value) : null})} className="bg-[#050810] border-[#243050] text-[#EEF3FF] font-mono h-8" />
                    </div>
                    <div>
                      <Label className="text-[#8B9FC4] text-[10px] uppercase">Target %</Label>
                      <Input type="number" step={0.01} value={spTarget.si ?? ''} onChange={e => setSpTarget({...spTarget, si: e.target.value ? Number(e.target.value) : null})} className="bg-[#050810] border-[#243050] text-[#EEF3FF] font-mono h-8" />
                    </div>
                  </div>
                </div>
                <div>
                  <h5 className="text-[#EEF3FF] font-bold text-sm mb-3">Manganese (Mn)</h5>
                  <div className="space-y-3">
                    <div>
                      <Label className="text-[#8B9FC4] text-[10px] uppercase">Current %</Label>
                      <Input type="number" step={0.01} value={spCurrent.mn ?? ''} onChange={e => setSpCurrent({...spCurrent, mn: e.target.value ? Number(e.target.value) : null})} className="bg-[#050810] border-[#243050] text-[#EEF3FF] font-mono h-8" />
                    </div>
                    <div>
                      <Label className="text-[#8B9FC4] text-[10px] uppercase">Target %</Label>
                      <Input type="number" step={0.01} value={spTarget.mn ?? ''} onChange={e => setSpTarget({...spTarget, mn: e.target.value ? Number(e.target.value) : null})} className="bg-[#050810] border-[#243050] text-[#EEF3FF] font-mono h-8" />
                    </div>
                  </div>
                </div>
             </div>
           </div>

           {(spTarget.c !== null || spTarget.si !== null || spTarget.mn !== null) && (
              <div className="space-y-6 animate-in fade-in zoom-in-95 duration-200">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="bg-[#050810] border border-[#243050] p-4 rounded-xl text-center">
                    <p className="text-[10px] uppercase text-[#8B9FC4] mb-1">Carburizer (kg)</p>
                    <p className="text-2xl font-bold font-mono text-[#EEF3FF]">{spAddC.toFixed(2)}</p>
                  </div>
                  <div className="bg-[#050810] border border-[#243050] p-4 rounded-xl text-center">
                    <p className="text-[10px] uppercase text-[#8B9FC4] mb-1">FeSi75 (kg)</p>
                    <p className="text-2xl font-bold font-mono text-[#EEF3FF]">{spAddSi.toFixed(2)}</p>
                  </div>
                  <div className="bg-[#050810] border border-[#243050] p-4 rounded-xl text-center">
                    <p className="text-[10px] uppercase text-[#8B9FC4] mb-1">FeMn80 (kg)</p>
                    <p className="text-2xl font-bold font-mono text-[#EEF3FF]">{spAddMn.toFixed(2)}</p>
                  </div>
                  <div className="bg-[#D4521A]/10 border border-[#D4521A]/30 p-4 rounded-xl text-center">
                    <p className="text-[10px] uppercase text-[#D4521A] mb-1">Total Additions</p>
                    <p className="text-2xl font-bold font-mono text-[#D4521A]">{(spAddC + spAddSi + spAddMn).toFixed(2)}</p>
                  </div>
                </div>

                <div className="border border-[#243050] rounded-xl overflow-hidden bg-[#050810]">
                   <table className="w-full text-sm text-left">
                     <thead className="bg-[#0C1221] border-b border-[#243050] text-[#8B9FC4] text-xs uppercase">
                       <tr>
                         <th className="px-6 py-3">Element</th>
                         <th className="px-6 py-3 text-center">Deficit %</th>
                         <th className="px-6 py-3 text-right">Element Req. (kg)</th>
                         <th className="px-6 py-3">Material Used</th>
                         <th className="px-6 py-3 text-right">Addition (kg)</th>
                       </tr>
                     </thead>
                     <tbody className="divide-y divide-[#243050]">
                        {[
                          { el: 'Carbon', def: spDeficitC, req: spReqC, mat: 'Carburizer', add: spAddC },
                          { el: 'Silicon', def: spDeficitSi, req: spReqSi, mat: 'FeSi75', add: spAddSi },
                          { el: 'Manganese', def: spDeficitMn, req: spReqMn, mat: 'FeMn80', add: spAddMn }
                        ].map(row => (
                          <tr key={row.el}>
                            <td className="px-6 py-3 font-bold text-[#EEF3FF]">{row.el}</td>
                            <td className={cn("px-6 py-3 text-center font-mono font-bold", row.def > 0 ? "text-red-400" : "text-green-400")}>
                              {row.def > 0 ? `+${row.def.toFixed(2)}%` : '≤ 0%'}
                            </td>
                            <td className="px-6 py-3 text-right font-mono text-[#C4D2EE]">{row.req.toFixed(2)}</td>
                            <td className="px-6 py-3 text-[#8B9FC4]">{row.mat}</td>
                            <td className="px-6 py-3 text-right font-mono font-bold text-[#D4521A]">
                              {row.def > 0 ? row.add.toFixed(2) : <span className="text-[#5A6E90] text-xs font-sans font-normal">No Addition</span>}
                            </td>
                          </tr>
                        ))}
                     </tbody>
                   </table>
                   <div className="bg-[#0C1221] p-4 border-t border-[#243050] text-[10px] text-[#5A6E90] text-center font-mono">
                     Engineering estimates only. Actual recovery varies with temperature, tap practice, and material grade. 
                     Recovery — Carburizer: 90% | FeSi75: 75% | FeMn80: 80%
                   </div>
                </div>
              </div>
           )}
        </div>
      )}
    </div>
  )
}

function CheckBadge() {
  return <Badge className="bg-green-500/10 text-green-400 border-green-500/20 text-[10px]">Recorded</Badge>
}
function PendingBadge() {
  return <Badge className="bg-amber-500/10 text-amber-500 border-amber-500/20 text-[10px]">Pending</Badge>
}
