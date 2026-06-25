const fs = require('fs');

let content = fs.readFileSync('src/domains/production/components/schedule-drawer.tsx', 'utf8');

// 1. Remove Dialog imports
content = content.replace(/import {\s*Dialog,\s*DialogContent,\s*DialogHeader,\s*DialogTitle,\s*} from '@\/shared\/ui\/dialog'\n/g, '');

// 2. Rename ScheduleModal to ScheduleDrawer
content = content.replace(/export function ScheduleModal/g, 'export function ScheduleDrawer');

// 3. Add isFading state
content = content.replace(/const \[entries, setEntries\] = useState<Record<string, { planned: number, actual: number }>>\({}\)/, 
`const [entries, setEntries] = useState<Record<string, { planned: number, actual: number }>>({})
  const [isFading, setIsFading] = useState(false)
  const [prevDate, setPrevDate] = useState(date)`);

// 4. Replace useEffect
content = content.replace(/\/\/ Initialize entries when schedules load\n\s*useEffect\(\(\) => \{\n\s*const newEntries: Record<string, \{ planned: number, actual: number \}> = \{\}\n\s*schedules\.forEach\(s => \{\n\s*newEntries\[s\.id\] = \{\s*planned: s\.plannedQuantity \|\| 0,\s*actual: s\.actualQuantity \|\| 0\s*\}\n\s*\}\)\n\s*setEntries\(newEntries\)\n\s*\}, \[schedules\]\)/, 
`// Fade animation logic on date change
  useEffect(() => {
    if (date !== prevDate && isOpen) {
      setIsFading(true)
      const timer = setTimeout(() => {
        const newEntries: Record<string, { planned: number, actual: number }> = {}
        schedules.forEach(s => {
          newEntries[s.id] = { 
            planned: s.plannedQuantity || 0, 
            actual: s.actualQuantity || 0 
          }
        })
        setEntries(newEntries)
        setPrevDate(date)
        setIsFading(false)
      }, 150)
      return () => clearTimeout(timer)
    } else {
      const newEntries: Record<string, { planned: number, actual: number }> = {}
      schedules.forEach(s => {
        newEntries[s.id] = { 
          planned: s.plannedQuantity || 0, 
          actual: s.actualQuantity || 0 
        }
      })
      setEntries(newEntries)
      setPrevDate(date)
    }
  }, [date, prevDate, schedules, isOpen])`);

// 5. Replace wrapper logic
content = content.replace(/<Dialog open={isOpen} onOpenChange={\(open\) => !open && handleClose\(\)}>\s*<DialogContent className="w-full sm:max-w-4xl bg-\[#050810\] border-\[#243050\] text-foreground">\s*<DialogHeader>\s*<DialogTitle className="text-xl font-heading text-\[#EEF3FF\]">\s*\{displayDate\}\s*<\/DialogTitle>\s*<\/DialogHeader>\s*<div className="space-y-6 py-4">/,
`<div 
      className={cn(
        "fixed top-0 right-0 h-full w-[420px] bg-[#0C1221] border-l border-[#243050] z-50 flex flex-col transform transition-transform duration-200 ease-out",
        isOpen ? "translate-x-0" : "translate-x-full"
      )}
    >
      <div className="flex items-center justify-between p-6 border-b border-[#243050] shrink-0">
        <h2 className="text-xl font-heading text-[#EEF3FF]">{displayDate}</h2>
        <button onClick={handleClose} className="p-2 rounded hover:bg-[#1A263D] text-[#8B9FC4] hover:text-[#EEF3FF] transition-colors">
          <X weight="bold" className="h-5 w-5" />
        </button>
      </div>

      <div className={cn("p-6 space-y-6 flex-1 overflow-y-auto transition-opacity duration-150", isFading ? "opacity-0" : "opacity-100")}>`);

content = content.replace(/<\/div>\s*<\/DialogContent>\s*<\/Dialog>/, `</div>\n    </div>`);

fs.writeFileSync('src/domains/production/components/schedule-drawer.tsx', content, 'utf8');
