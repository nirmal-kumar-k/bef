import mongoose, { Schema, Document, Model } from 'mongoose'

export interface ISchedule extends Document {
  orderId: mongoose.Types.ObjectId | string
  date: string // YYYY-MM-DD
  stage: 'Moulding' | 'Melting' | 'Fettling'
  plannedQuantity: number
  actualQuantity: number
  createdAt: Date
  updatedAt: Date
}

const ScheduleSchema = new Schema<ISchedule>(
  {
    orderId: { type: Schema.Types.ObjectId, ref: 'Order', required: true },
    date: { type: String, required: true },
    stage: { 
      type: String, 
      enum: ['Moulding', 'Melting', 'Fettling'], 
      required: true 
    },
    plannedQuantity: { type: Number, default: 0 },
    actualQuantity: { type: Number, default: 0 },
  },
  { timestamps: true }
)

if (mongoose.models.Schedule) {
  delete mongoose.models.Schedule
}

const Schedule: Model<ISchedule> = mongoose.model<ISchedule>('Schedule', ScheduleSchema)

export default Schedule
