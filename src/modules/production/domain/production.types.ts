export type StageUnit = 'moulds' | 'pieces' | 'heats' | 'cores'

export interface StageData {
  planned: number
  completed: number
  pending: number
  variance: number
  unit: StageUnit
  // For Melting & Pouring
  heatDetails?: Array<{
    heatNo: string
    quantity: number // either heats or poured moulds
    completed: boolean
  }>
  // For Dispatch
  invoiceNo?: string
}

export interface ProductionJob {
  id: string
  orderNo: string
  customer: string
  productCode: string
  productName: string
  patternCode: string
  cavities: number
  coreBoxes: number
  boxWeight: number // in kg
  
  stages: {
    core: StageData
    melting: StageData
    moulding: StageData
    pouring: StageData
    knockout: StageData
    shotBlasting: StageData
    grinding: StageData
    inspection: StageData
    readyForDispatch: StageData
  }
}

export const initialJobs: ProductionJob[] = [
  {
    id: "JOB-001",
    orderNo: "PO-98214",
    customer: "TATA Motors",
    productCode: "PRD-0512",
    productName: "Engine Block X7",
    patternCode: "PAT-001",
    cavities: 2,
    coreBoxes: 4,
    boxWeight: 150,
    stages: {
      core: { planned: 100, completed: 80, pending: 20, variance: -20, unit: 'cores' },
      melting: { 
        planned: 4, completed: 2, pending: 2, variance: -2, unit: 'heats',
        heatDetails: [
          { heatNo: "H001", quantity: 1, completed: true },
          { heatNo: "H002", quantity: 1, completed: true },
          { heatNo: "H003", quantity: 1, completed: false },
          { heatNo: "H004", quantity: 1, completed: false },
        ]
      },
      moulding: { planned: 50, completed: 40, pending: 10, variance: -10, unit: 'moulds' },
      pouring: { 
        planned: 40, completed: 30, pending: 10, variance: -10, unit: 'moulds',
        heatDetails: [
          { heatNo: "H001", quantity: 15, completed: true },
          { heatNo: "H002", quantity: 15, completed: true },
        ]
      },
      knockout: { planned: 30, completed: 25, pending: 5, variance: -5, unit: 'moulds' },
      
      // Post-knockout: Unit changes to Pieces (moulds * cavities). 
      // So 25 completed moulds * 2 cavities = 50 planned pieces for shot blasting
      shotBlasting: { planned: 50, completed: 40, pending: 10, variance: -10, unit: 'pieces' },
      grinding: { planned: 40, completed: 35, pending: 5, variance: -5, unit: 'pieces' },
      inspection: { planned: 35, completed: 35, pending: 0, variance: 0, unit: 'pieces' },
      readyForDispatch: { planned: 35, completed: 30, pending: 5, variance: -5, unit: 'pieces', invoiceNo: "INV-2024-081" }
    }
  },
  {
    id: "JOB-002",
    orderNo: "PO-98215",
    customer: "Mahindra",
    productCode: "PRD-0881",
    productName: "Gearbox Housing",
    patternCode: "PAT-005",
    cavities: 1,
    coreBoxes: 2,
    boxWeight: 80,
    stages: {
      core: { planned: 120, completed: 120, pending: 0, variance: 0, unit: 'cores' },
      melting: { 
        planned: 2, completed: 2, pending: 0, variance: 0, unit: 'heats',
        heatDetails: [
          { heatNo: "H005", quantity: 1, completed: true },
          { heatNo: "H006", quantity: 1, completed: true },
        ]
      },
      moulding: { planned: 60, completed: 60, pending: 0, variance: 0, unit: 'moulds' },
      pouring: { 
        planned: 60, completed: 60, pending: 0, variance: 0, unit: 'moulds',
        heatDetails: [
          { heatNo: "H005", quantity: 30, completed: true },
          { heatNo: "H006", quantity: 30, completed: true },
        ]
      },
      knockout: { planned: 60, completed: 60, pending: 0, variance: 0, unit: 'moulds' },
      
      // 60 completed moulds * 1 cavity = 60 pieces
      shotBlasting: { planned: 60, completed: 50, pending: 10, variance: -10, unit: 'pieces' },
      grinding: { planned: 50, completed: 50, pending: 0, variance: 0, unit: 'pieces' },
      inspection: { planned: 50, completed: 48, pending: 2, variance: -2, unit: 'pieces' },
      readyForDispatch: { planned: 48, completed: 0, pending: 48, variance: -48, unit: 'pieces' }
    }
  }
]
