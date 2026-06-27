import { NextRequest, NextResponse } from 'next/server'
import dbConnect from '@/infrastructure/db'
import ProductionPlan from '@/modules/production/domain/production-plan.model'

export async function GET(request: NextRequest) {
  try {
    await dbConnect()
    
    // Support filtering by date range or specific stages if needed later, but fetch all for now
    const plans = await ProductionPlan.find({}).sort({ date: 1 }).lean()
    
    // Map _id to id
    const mappedPlans = plans.map((p: any) => ({
      ...p,
      id: p._id.toString()
    }))

    return NextResponse.json(mappedPlans)
  } catch (error) {
    console.error('GET /api/production-plans error:', error)
    return NextResponse.json({ error: 'Failed to fetch production plans' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    await dbConnect()
    const body = await request.json()
    const newPlan = await ProductionPlan.create(body)
    const planObj = newPlan.toObject()
    
    return NextResponse.json({ ...planObj, id: planObj._id.toString() }, { status: 201 })
  } catch (error) {
    console.error('POST /api/production-plans error:', error)
    return NextResponse.json({ error: 'Failed to create production plan' }, { status: 500 })
  }
}
