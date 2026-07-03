'use client'

import { useState, useEffect } from 'react'
import { X } from '@phosphor-icons/react'
import { Button } from '@/shared/ui/button'
import { Input } from '@/shared/ui/input'
import { Label } from '@/shared/ui/label'
import { Textarea } from '@/shared/ui/textarea'
import { handleEnterToTab } from '@/shared/lib/utils'
import type { Grade } from '../domain/grade.types'

interface GradeModalProps {
  isOpen: boolean
  onClose: () => void
  onSave: (grade: Partial<Grade>) => void
  grade: Grade | null
}

export function GradeModal({ isOpen, onClose, onSave, grade }: GradeModalProps) {
  const [code, setCode] = useState('')
  const [name, setName] = useState('')
  const [c, setC] = useState('')
  const [si, setSi] = useState('')
  const [mn, setMn] = useState('')
  const [p, setP] = useState('')
  const [s, setS] = useState('')
  const [remarks, setRemarks] = useState('')

  useEffect(() => {
    if (grade) {
      setCode(grade.code)
      setName(grade.name)
      setC(grade.c)
      setSi(grade.si)
      setMn(grade.mn)
      setP(grade.p)
      setS(grade.s)
      setRemarks(grade.remarks || '')
    } else {
      setCode('')
      setName('')
      setC('')
      setSi('')
      setMn('')
      setP('')
      setS('')
      setRemarks('')
    }
  }, [grade, isOpen])

  if (!isOpen) return null

  const handleSave = () => {
    onSave({
      id: grade?.id,
      code,
      name,
      c,
      si,
      mn,
      p,
      s,
      remarks,
    })
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-background/80 backdrop-blur-sm transition-opacity" 
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="relative w-full max-w-3xl bg-[#F4F6FB] border border-sidebar-border rounded-xl shadow-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-sidebar-border bg-[#FFFFFF] rounded-t-xl">
          <h2 className="text-xl font-bold text-foreground">
            {grade ? 'Edit Grade' : 'Add Grade'}
          </h2>
          <button 
            onClick={onClose}
            className="p-2 text-muted-foreground hover:text-foreground hover:bg-sidebar-accent rounded-md transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6" onKeyDown={handleEnterToTab}>
          {/* Row 1 */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-muted-foreground text-xs uppercase tracking-wider">Grade Code</Label>
              <Input 
                value={code} 
                onChange={(e) => setCode(e.target.value)} 
                placeholder="e.g. FC 200"
                className="bg-[#FFFFFF] border-sidebar-border"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-muted-foreground text-xs uppercase tracking-wider">Grade Name</Label>
              <Input 
                value={name} 
                onChange={(e) => setName(e.target.value)} 
                placeholder="e.g. Grey Cast Iron 200"
                className="bg-[#FFFFFF] border-sidebar-border"
              />
            </div>
          </div>

          {/* Row 2 */}
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <Label className="text-muted-foreground text-xs uppercase tracking-wider">C%</Label>
              <Input 
                type="text"
                value={c} 
                onChange={(e) => setC(e.target.value)} 
                placeholder="e.g. 3.1–3.4"
                className="bg-[#FFFFFF] border-sidebar-border"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-muted-foreground text-xs uppercase tracking-wider">Si%</Label>
              <Input 
                type="text"
                value={si} 
                onChange={(e) => setSi(e.target.value)} 
                placeholder="e.g. 1.9–2.3"
                className="bg-[#FFFFFF] border-sidebar-border"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-muted-foreground text-xs uppercase tracking-wider">Mn%</Label>
              <Input 
                type="text"
                value={mn} 
                onChange={(e) => setMn(e.target.value)} 
                placeholder="e.g. 0.6–0.9"
                className="bg-[#FFFFFF] border-sidebar-border"
              />
            </div>
          </div>

          {/* Row 3 */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-muted-foreground text-xs uppercase tracking-wider">P%</Label>
              <Input 
                type="text"
                value={p} 
                onChange={(e) => setP(e.target.value)} 
                placeholder="e.g. ≤0.15"
                className="bg-[#FFFFFF] border-sidebar-border"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-muted-foreground text-xs uppercase tracking-wider">S%</Label>
              <Input 
                type="text"
                value={s} 
                onChange={(e) => setS(e.target.value)} 
                placeholder="e.g. ≤0.12"
                className="bg-[#FFFFFF] border-sidebar-border"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-muted-foreground text-xs uppercase tracking-wider">Remarks</Label>
            <Textarea 
              value={remarks} 
              onChange={(e) => setRemarks(e.target.value)} 
              placeholder="Add any additional notes..."
              className="bg-[#FFFFFF] border-sidebar-border min-h-[100px] resize-none"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-sidebar-border bg-[#FFFFFF] rounded-b-xl flex justify-end gap-3 shrink-0">
          <Button 
            variant="outline" 
            onClick={onClose}
            className="border-sidebar-border hover:bg-sidebar-accent text-foreground"
          >
            Cancel
          </Button>
          <Button 
            onClick={handleSave}
            disabled={!code.trim() || !name.trim()}
            className="bg-[#4F46E5] hover:bg-[#4F46E5]/90 text-white font-semibold min-w-[120px]"
          >
            Save Grade
          </Button>
        </div>
      </div>
    </div>
  )
}
