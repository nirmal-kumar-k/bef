import { NextRequest, NextResponse } from 'next/server'
import dbConnect from '@/infrastructure/db'
import Shift from '@/modules/production/domain/shift.model'

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await dbConnect()
    const body = await request.json()
    const { id, _id, createdAt, updatedAt, ...updateData } = body
    const { id: paramId } = await params
    
    const shift = await Shift.findByIdAndUpdate(paramId, updateData, { new: true })
    if (!shift) {
      return NextResponse.json({ error: 'Shift not found' }, { status: 404 })
    }
    const obj = shift.toObject()
    return NextResponse.json({ ...obj, id: obj._id?.toString() })
  } catch (error) {
    console.error('PUT /api/shifts/[id] error:', error)
    return NextResponse.json({ error: 'Failed to update shift' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await dbConnect()
    const { id: paramId } = await params
    const shift = await Shift.findByIdAndDelete(paramId)
    if (!shift) {
      return NextResponse.json({ error: 'Shift not found' }, { status: 404 })
    }
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('DELETE /api/shifts/[id] error:', error)
    return NextResponse.json({ error: 'Failed to delete shift' }, { status: 500 })
  }
}
