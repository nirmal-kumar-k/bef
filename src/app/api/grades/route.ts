import { NextRequest, NextResponse } from 'next/server'
import { asc } from 'drizzle-orm'
import { db } from '@/infrastructure/database/client'
import { grades } from '@/infrastructure/database/schema'

export async function GET() {
  try {
    const rows = await db.select().from(grades).orderBy(asc(grades.code))
    return NextResponse.json(rows)
  } catch (error) {
    console.error('GET /api/grades error:', error)
    return NextResponse.json({ error: 'Failed to fetch grades' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const [row] = await db.insert(grades).values(body).returning()
    return NextResponse.json(row, { status: 201 })
  } catch (error) {
    console.error('POST /api/grades error:', error)
    return NextResponse.json({ error: 'Failed to create grade' }, { status: 500 })
  }
}
