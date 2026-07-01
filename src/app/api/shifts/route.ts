import { NextRequest, NextResponse } from 'next/server'
import dbConnect from '@/infrastructure/db'
import Shift from '@/modules/production/domain/shift.model'

export async function GET() {
  try {
    await dbConnect()
    const shifts = await Shift.find({}).sort({ name: 1 }).lean()
    const mapped = shifts.map((s) => ({ ...s, id: s._id?.toString() }))
    return NextResponse.json(mapped)
  } catch (error) {
    console.error('GET /api/shifts error:', error)
    return NextResponse.json({ error: 'Failed to fetch shifts' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    await dbConnect()
    const body = await request.json()
    const shift = await Shift.create(body)
    const obj = shift.toObject()
    return NextResponse.json({ ...obj, id: obj._id?.toString() }, { status: 201 })
  } catch (error) {
    console.error('POST /api/shifts error:', error)
    return NextResponse.json({ error: 'Failed to create shift' }, { status: 500 })
  }
}
