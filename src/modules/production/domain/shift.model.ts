import mongoose, { Schema, Document, Model } from 'mongoose'

export interface IShift extends Document {
  name: string
  startTime: string
  endTime: string
  breakStartTime?: string
  breakEndTime?: string
  isActive: boolean
  createdAt: Date
  updatedAt: Date
}

const ShiftSchema: Schema = new Schema(
  {
    name: { type: String, required: true, unique: true },
    startTime: { type: String, required: true },
    endTime: { type: String, required: true },
    breakStartTime: { type: String, required: false },
    breakEndTime: { type: String, required: false },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
)

const Shift: Model<IShift> = mongoose.models.Shift || mongoose.model<IShift>('Shift', ShiftSchema)

export default Shift
