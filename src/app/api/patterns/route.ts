import { NextRequest, NextResponse } from 'next/server'
import dbConnect from '@/infrastructure/db'
import Pattern from '@/domains/patterns/models/pattern.model'

export async function GET() {
  try {
    await dbConnect()
    const patterns = await Pattern.find({}).sort({ createdAt: -1 }).lean()
    const mapped = patterns.map((p) => ({ ...p, id: p._id?.toString() }))
    return NextResponse.json(mapped)
  } catch (error) {
    console.error('GET /api/patterns error:', error)
    return NextResponse.json({ error: 'Failed to fetch patterns' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    await dbConnect()
    const body = await request.json()
    const pattern = await Pattern.create(body)
    const obj = pattern.toObject()
    return NextResponse.json({ ...obj, id: obj._id?.toString() }, { status: 201 })
  } catch (error) {
    console.error('POST /api/patterns error:', error)
    return NextResponse.json({ error: 'Failed to create pattern' }, { status: 500 })
  }
}
