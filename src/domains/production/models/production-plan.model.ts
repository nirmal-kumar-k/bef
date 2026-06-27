import mongoose, { Schema, Document, Model } from 'mongoose'

export interface IProductionPlan extends Document {
  date: string // YYYY-MM-DD
  orderId: string
  itemId: string // to link to a specific item in the order (orderId-itemIndex)
  stage: 'Core' | 'Mould' | 'Melt'
  coreBoxCode?: string // Only for 'Core' stage
  quantityScheduled: number
  laborersAssigned: number
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
    laborersAssigned: { type: Number, required: true, min: 1 },
  },
  { timestamps: true }
)

const ProductionPlan: Model<IProductionPlan> =
  mongoose.models.ProductionPlan || mongoose.model<IProductionPlan>('ProductionPlan', ProductionPlanSchema)

export default ProductionPlan
