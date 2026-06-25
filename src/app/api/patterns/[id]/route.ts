import { NextRequest, NextResponse } from 'next/server'
import dbConnect from '@/infrastructure/db'
import Pattern from '@/domains/patterns/models/pattern.model'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await dbConnect()
    const { id } = await params
    const pattern = await Pattern.findById(id).lean()
    if (!pattern) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json({ ...pattern, id: pattern._id?.toString() })
  } catch (error) {
    console.error('GET /api/patterns/[id] error:', error)
    return NextResponse.json({ error: 'Failed to fetch pattern' }, { status: 500 })
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await dbConnect()
    const { id } = await params
    const body = await request.json()
    const pattern = await Pattern.findByIdAndUpdate(id, body, { new: true }).lean()
    if (!pattern) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json({ ...pattern, id: pattern._id?.toString() })
  } catch (error) {
    console.error('PUT /api/patterns/[id] error:', error)
    return NextResponse.json({ error: 'Failed to update pattern' }, { status: 500 })
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await dbConnect()
    const { id } = await params
    await Pattern.findByIdAndDelete(id)
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('DELETE /api/patterns/[id] error:', error)
    return NextResponse.json({ error: 'Failed to delete pattern' }, { status: 500 })
  }
}
