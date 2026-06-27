const fs = require('fs')

let code = fs.readFileSync('src/domains/production/components/mould-planning-modal.tsx', 'utf-8')

code = code.replace(/CorePlanningModal/g, 'MouldPlanningModal')
code = code.replace(/activeCoreBoxes/g, 'activeMoulds')
code = code.replace(/orderCoreBacklogs/g, 'orderMouldBacklogs')
code = code.replace(/coreBoxCode/g, 'patternRef')
code = code.replace(/avgCoreProduction/g, 'avgMouldsPerHour')
code = code.replace(/CORE PLANNING/g, 'MOULD PLANNING')
code = code.replace(/Core Box/g, 'Pattern')
code = code.replace(/core boxes/g, 'moulds')
code = code.replace(/stage: 'Core'/g, "stage: 'Mould'")

// In Section 1 Cards: "Remaining to Plan"
// We want to add moulding type dynamically if needed, but the original core one looks fine for moulds.

fs.writeFileSync('src/domains/production/components/mould-planning-modal.tsx', code)
