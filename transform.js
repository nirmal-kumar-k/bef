const fs = require('fs')

let code = fs.readFileSync('src/domains/production/components/mould-planning-modal.tsx', 'utf-8')

code = code.replace(/CorePlanningModal/g, 'MouldPlanningModal')
code = code.replace(/orderCoreBacklog/g, 'orderMouldBacklog')
code = code.replace(/activeCoreBoxes/g, 'activeMoulds')
code = code.replace(/coreBoxCode/g, 'patternRef')
code = code.replace(/Core Box/g, 'Pattern')
code = code.replace(/CORE PLANNING/g, 'MOULD PLANNING')

fs.writeFileSync('src/domains/production/components/mould-planning-modal.tsx', code)
