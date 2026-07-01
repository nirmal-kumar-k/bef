import mongoose, { Document, Model, Schema } from 'mongoose'

export interface IEquipment extends Document {
  name: string
  type: 'Furnace' | 'Moulding Machine' | 'Core Machine' | 'Knockout'
  weightCapacity?: number // in kg
  
  // Furnace specific
  firstHeatDurationMins?: number
  regularHeatDurationMins?: number
  
  // Knockout specific
  avgPiecesPerHour?: number
  
  isActive: boolean
  createdAt: Date
  updatedAt: Date
}

const EquipmentSchema = new Schema<IEquipment>(
  {
    name: { type: String, required: true },
    type: { 
      type: String, 
      required: true, 
      enum: ['Furnace', 'Moulding Machine', 'Core Machine', 'Knockout'] 
    },
    weightCapacity: { type: Number },
    firstHeatDurationMins: { type: Number, default: 150 },
    regularHeatDurationMins: { type: Number, default: 150 },
    avgPiecesPerHour: { type: Number },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
)

export const EquipmentModel: Model<IEquipment> =
  mongoose.models.Equipment || mongoose.model<IEquipment>('Equipment', EquipmentSchema)
