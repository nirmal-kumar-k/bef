import mongoose, { Schema, Document, Model } from 'mongoose'

export interface IProductionPlan extends Document {
  date: string // YYYY-MM-DD
  orderId: string
  itemId: string // to link to a specific item in the order (orderId-itemIndex)
  stage: 'Core' | 'Mould' | 'Melt'
  coreBoxCode?: string // Only for 'Core' stage
  quantityScheduled: number
  laborersAssigned: number
  workersAssigned?: number
  equipmentId?: string
  hourlyTargets?: Record<string, number>
  hourlyWorkers?: Record<string, number>
  
  // Melt-specific fields
  heatNo?: string
  grade?: string
  meltWeight?: number
  actualQuantity?: number
  actuals?: {
    pigIron?: number
    scrap?: number
    feMn?: number
    carburizer?: number
  }
  isPending?: boolean
  plannedCharge?: {
    pigIron?: number
    scrap?: number
    feMn?: number
    carburizer?: number
  }
  startTime?: string
  endTime?: string

  createdAt: Date
  updatedAt: Date
}

const ProductionPlanSchema = new Schema<IProductionPlan>(
  {
    date: { type: String, required: true },
    orderId: { type: String, required: true },
    itemId: { type: String, required: true },
    stage: { type: String, enum: ['Core', 'Mould', 'Melt'], required: true },
    coreBoxCode: { type: String, default: '' },
    quantityScheduled: { type: Number, required: true, min: 0 },
    laborersAssigned: { type: Number, default: 1 },
    workersAssigned: { type: Number },
    equipmentId: { type: String },
    hourlyTargets: { type: Map, of: Number },
    hourlyWorkers: { type: Map, of: Number },
    
    // Melt-specific fields
    heatNo: { type: String },
    grade: { type: String },
    meltWeight: { type: Number },
    actualQuantity: { type: Number },
    actuals: {
      pigIron: Number,
      scrap: Number,
      feMn: Number,
      carburizer: Number
    },
    isPending: { type: Boolean, default: false },
    plannedCharge: {
      pigIron: Number,
      scrap: Number,
      feMn: Number,
      carburizer: Number
    },
    startTime: { type: String },
    endTime: { type: String }
  },
  { timestamps: true }
)

if (mongoose.models.ProductionPlan) {
  delete mongoose.models.ProductionPlan;
}

const ProductionPlan: Model<IProductionPlan> = mongoose.model<IProductionPlan>('ProductionPlan', ProductionPlanSchema)

export default ProductionPlan

