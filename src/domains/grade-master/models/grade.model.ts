import mongoose, { Schema, Document, Model } from 'mongoose'

export interface IGrade extends Document {
  code: string
  name: string
  c: string
  si: string
  mn: string
  p: string
  s: string
  remarks?: string
  createdAt: Date
  updatedAt: Date
}

const GradeSchema = new Schema<IGrade>(
  {
    code: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    c: { type: String, default: '' },
    si: { type: String, default: '' },
    mn: { type: String, default: '' },
    p: { type: String, default: '' },
    s: { type: String, default: '' },
    remarks: { type: String },
  },
  { timestamps: true }
)

const Grade: Model<IGrade> =
  mongoose.models.Grade || mongoose.model<IGrade>('Grade', GradeSchema)

export default Grade
