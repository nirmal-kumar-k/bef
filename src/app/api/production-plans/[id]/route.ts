import { NextRequest, NextResponse } from 'next/server'
import dbConnect from '@/infrastructure/db'
import ProductionPlan from '@/domains/production/models/production-plan.model'

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await dbConnect()
    const { id } = await params
    const body = await request.json()
    const plan = await ProductionPlan.findByIdAndUpdate(id, body, { new: true }).lean()
    if (!plan) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json({ ...plan, id: plan._id?.toString() })
  } catch (error) {
    console.error('PUT /api/production-plans/[id] error:', error)
    return NextResponse.json({ error: 'Failed to update plan' }, { status: 500 })
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await dbConnect()
    const { id } = await params
    await ProductionPlan.findByIdAndDelete(id)
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('DELETE /api/production-plans/[id] error:', error)
    return NextResponse.json({ error: 'Failed to delete plan' }, { status: 500 })
  }
}
