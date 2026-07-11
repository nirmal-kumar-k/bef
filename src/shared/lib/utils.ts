import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function handleEnterToTab(e: React.KeyboardEvent) {
  if (e.key === 'Enter') {
    const target = e.target as HTMLElement;
    
    // Let textarea make new lines ONLY with Shift+Enter
    if (target.tagName.toLowerCase() === 'textarea') {
      if (!e.shiftKey) {
        e.preventDefault();
      } else {
        return;
      }
    }
    
    // Let buttons (Select triggers, Add, Save) work normally with Enter
    if (target.tagName.toLowerCase() === 'button') return;
    
    // Let dropdown items be selected normally
    if (target.closest('[role="listbox"]') || target.closest('[cmdk-list]')) return;

    e.preventDefault();
    
    const focusable = Array.from(
      document.querySelectorAll(
        'input:not([disabled]), textarea:not([disabled]), button:not([disabled]), [tabindex="0"]:not([tabindex="-1"])'
      )
    ) as HTMLElement[];
    
    const visibleFocusable = focusable.filter(el => el.offsetParent !== null);
    const index = visibleFocusable.indexOf(target);
    
    if (index > -1 && index + 1 < visibleFocusable.length) {
      visibleFocusable[index + 1].focus();
    }
  }
}

export function parseTimeToMinutes(timeStr: string): number {
  const [time, modifier] = timeStr.trim().split(' ')
  let [hours, minutes] = time.split(':').map(Number)
  if (hours === 12) {
    hours = modifier === 'AM' ? 0 : 12
  } else if (modifier === 'PM') {
    hours += 12
  }
  return hours * 60 + (minutes || 0)
}

export interface TimeSlot {
  time: string
  endTime: string
  hours: number
}

function formatMinutesToTime(mins: number): string {
  let h = Math.floor((mins % (24 * 60)) / 60)
  const m = mins % 60
  const ampm = h >= 12 ? 'PM' : 'AM'
  h = h % 12
  h = h ? h : 12 // the hour '0' should be '12'
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')} ${ampm}`
}

export function generateTimeSlots(startTime: string, endTime: string, breaks: {startTime: string, endTime: string}[] = []): TimeSlot[] {
  let startMins = parseTimeToMinutes(startTime)
  let endMins = parseTimeToMinutes(endTime)
  if (endMins <= startMins) {
    endMins += 24 * 60 // spans across midnight
  }
  
  // Parse and normalize breaks
  const normalizedBreaks = breaks.map(b => {
    let bs = parseTimeToMinutes(b.startTime)
    let be = parseTimeToMinutes(b.endTime)
    // If break falls on the next day relative to 00:00 but shift started previous day
    if (bs < startMins) bs += 24 * 60
    if (be <= bs) be += 24 * 60
    return { bs, be }
  }).sort((a, b) => a.bs - b.bs) // sort by start time
  
  const slots: TimeSlot[] = []
  let currentMins = startMins
  
  while (currentMins < endMins) {
    // Check if we are currently inside a break
    const activeBreak = normalizedBreaks.find(b => currentMins >= b.bs && currentMins < b.be)
    if (activeBreak) {
      currentMins = activeBreak.be
      continue
    }
  
    const slotStr = formatMinutesToTime(currentMins)

    let nextHourMins = currentMins + 60

    // Check if a break starts before the next hour mark
    const nextBreak = normalizedBreaks.find(b => b.bs > currentMins && b.bs < nextHourMins)
    if (nextBreak) {
      nextHourMins = nextBreak.bs
    }

    if (nextHourMins > endMins) {
      nextHourMins = endMins
    }

    const durationMins = nextHourMins - currentMins
    const durationHours = durationMins / 60

    if (durationHours > 0) {
      slots.push({ time: slotStr, endTime: formatMinutesToTime(nextHourMins), hours: durationHours })
    }

    currentMins = nextHourMins
  }
  return slots
}

