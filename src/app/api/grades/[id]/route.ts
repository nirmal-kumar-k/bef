import { NextRequest, NextResponse } from 'next/server'
import dbConnect from '@/infrastructure/db'
import Grade from '@/modules/grade-master/domain/grade.model'

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await dbConnect()
    const { id } = await params
    const body = await request.json()
    const grade = await Grade.findByIdAndUpdate(id, body, { new: true }).lean()
    if (!grade) {
      return NextResponse.json({ error: 'Grade not found' }, { status: 404 })
    }
    return NextResponse.json({ ...grade, id: grade._id?.toString() })
  } catch (error) {
    console.error('PUT /api/grades/[id] error:', error)
    return NextResponse.json({ error: 'Failed to update grade' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await dbConnect()
    const { id } = await params
    await Grade.findByIdAndDelete(id)
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('DELETE /api/grades/[id] error:', error)
    return NextResponse.json({ error: 'Failed to delete grade' }, { status: 500 })
  }
}
