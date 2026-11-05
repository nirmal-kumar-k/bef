import { NextRequest, NextResponse } from 'next/server'
import { asc } from 'drizzle-orm'
import { db } from '@/infrastructure/database/client'
import { grades } from '@/infrastructure/database/schema'
import { publishOnSuccess } from '@/infrastructure/realtime/route-wrapper'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const rows = await db.select().from(grades).orderBy(asc(grades.code))
    return NextResponse.json(rows)
  } catch (error) {
    console.error('GET /api/grades error:', error)
    return NextResponse.json({ error: 'Failed to fetch grades' }, { status: 500 })
  }
}

async function postHandler(request: NextRequest) {
  try {
    const body = await request.json()
    const { id, ...insertData } = body
    // A client-generated id (assigned the moment the grade is created in the
    // UI) makes this idempotent - a double-click or slow-network retry of
    // the same not-yet-confirmed create updates the same row instead of
    // creating a duplicate grade.
    const [row] = id
      ? await db.insert(grades).values({ id, ...insertData })
          .onConflictDoUpdate({ target: grades.id, set: insertData })
          .returning()
      : await db.insert(grades).values(insertData).returning()
    return NextResponse.json(row, { status: 201 })
  } catch (error) {
    console.error('POST /api/grades error:', error)
    return NextResponse.json({ error: 'Failed to create grade' }, { status: 500 })
  }
}

// Tell other open screens about successful writes (see src/infrastructure/realtime).
export const POST = publishOnSuccess('master', 'grades', 'create', postHandler)
