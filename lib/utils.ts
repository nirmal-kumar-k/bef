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

