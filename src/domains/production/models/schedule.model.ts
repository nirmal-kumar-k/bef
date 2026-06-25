import mongoose, { Schema, Document, Model } from 'mongoose'

export interface IStageData {
  planned: number
  completed: number
  pending: number
  variance: number
  unit: string
}

export interface ISchedule extends Document {
  orderId: mongoose.Types.ObjectId | string
  date: string // YYYY-MM-DD
  shift: 'Morning' | 'Evening'
  priority: 'High' | 'Normal'
  remarks: string
  status: 'Planned' | 'In Progress' | 'Completed' | 'Delayed' | 'Rescheduled'
  stages: {
    core: IStageData
    melting: IStageData
    moulding: IStageData
    pouring: IStageData
    knockout: IStageData
    shotBlasting: IStageData
    grinding: IStageData
    inspection: IStageData
    readyForDispatch: IStageData
  }
  createdAt: Date
  updatedAt: Date
}

const StageDataSchema = new Schema<IStageData>(
  {
    planned: { type: Number, default: 0 },
    completed: { type: Number, default: 0 },
    pending: { type: Number, default: 0 },
    variance: { type: Number, default: 0 },
    unit: { type: String, default: 'units' },
    rejected: { type: Number, default: 0 },
    rework: { type: Number, default: 0 },
    operator: { type: String, default: '' },
    remarks: { type: String, default: '' },
    invoiceNumber: { type: String, default: '' },
    vehicleNumber: { type: String, default: '' },
    driverName: { type: String, default: '' }
  },
  { _id: false }
)

const ScheduleSchema = new Schema<ISchedule>(
  {
    orderId: { type: Schema.Types.ObjectId, ref: 'Order', required: true },
    date: { type: String, required: true },
    shift: { type: String, enum: ['Morning', 'Evening'], default: 'Morning' },
    priority: { type: String, enum: ['High', 'Normal'], default: 'Normal' },
    remarks: { type: String, default: '' },
    status: { 
      type: String, 
      enum: ['Planned', 'In Progress', 'Completed', 'Delayed', 'Rescheduled'],
      default: 'Planned' 
    },
    stages: {
      core: { type: StageDataSchema, default: () => ({ unit: 'cores' }) },
      melting: { type: StageDataSchema, default: () => ({ unit: 'heats' }) },
      moulding: { type: StageDataSchema, default: () => ({ unit: 'moulds' }) },
      pouring: { type: StageDataSchema, default: () => ({ unit: 'moulds' }) },
      knockout: { type: StageDataSchema, default: () => ({ unit: 'pieces' }) },
      shotBlasting: { type: StageDataSchema, default: () => ({ unit: 'pieces' }) },
      grinding: { type: StageDataSchema, default: () => ({ unit: 'pieces' }) },
      inspection: { type: StageDataSchema, default: () => ({ unit: 'pieces' }) },
      readyForDispatch: { type: StageDataSchema, default: () => ({ unit: 'pieces' }) },
    }
  },
  { timestamps: true }
)

if (mongoose.models.Schedule) {
  delete mongoose.models.Schedule
}

const Schedule: Model<ISchedule> = mongoose.model<ISchedule>('Schedule', ScheduleSchema)

export default Schedule
