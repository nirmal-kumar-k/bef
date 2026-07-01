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
  hours: number
}

export function generateTimeSlots(startTime: string, endTime: string): TimeSlot[] {
  let startMins = parseTimeToMinutes(startTime)
  let endMins = parseTimeToMinutes(endTime)
  if (endMins <= startMins) {
    endMins += 24 * 60 // spans across midnight
  }
  
  const slots: TimeSlot[] = []
  let currentMins = startMins
  
  while (currentMins < endMins) {
    let h = Math.floor((currentMins % (24 * 60)) / 60)
    let m = currentMins % 60
    const ampm = h >= 12 ? 'PM' : 'AM'
    h = h % 12
    h = h ? h : 12 // the hour '0' should be '12'
    
    const hStr = h.toString().padStart(2, '0')
    const mStr = m.toString().padStart(2, '0')
    
    const slotStr = `${hStr}:${mStr} ${ampm}`
    
    // Calculate duration. Normally 60 mins (1 hour), but could be less for the last slot
    const nextHourMins = currentMins + 60
    const durationMins = nextHourMins > endMins ? (endMins - currentMins) : 60
    const durationHours = durationMins / 60
    
    slots.push({ time: slotStr, hours: durationHours })
    
    // Increment by 1 hour (60 mins)
    currentMins += 60
  }
  return slots
}

