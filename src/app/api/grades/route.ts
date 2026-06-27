import { NextRequest, NextResponse } from 'next/server'
import dbConnect from '@/infrastructure/db'
import Grade from '@/modules/grade-master/domain/grade.model'

export async function GET() {
  try {
    await dbConnect()
    const grades = await Grade.find({}).sort({ code: 1 }).lean()
    const mapped = grades.map((g) => ({ ...g, id: g._id?.toString() }))
    return NextResponse.json(mapped)
  } catch (error) {
    console.error('GET /api/grades error:', error)
    return NextResponse.json({ error: 'Failed to fetch grades' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    await dbConnect()
    const body = await request.json()
    const grade = await Grade.create(body)
    const obj = grade.toObject()
    return NextResponse.json({ ...obj, id: obj._id?.toString() }, { status: 201 })
  } catch (error) {
    console.error('POST /api/grades error:', error)
    return NextResponse.json({ error: 'Failed to create grade' }, { status: 500 })
  }
}
