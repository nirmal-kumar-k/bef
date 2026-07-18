export interface BacklogItem {
  itemId: string
  orderNo: string
  patternRef: string
  productName: string
  coreBoxCode?: string // Only for 'Core'
  totalRequired: number
  totalScheduled: number
  unit: string
}
