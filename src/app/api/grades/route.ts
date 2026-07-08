import { NextRequest, NextResponse } from 'next/server'
import { asc } from 'drizzle-orm'
import { db } from '@/infrastructure/database/client'
import { grades } from '@/infrastructure/database/schema'

export const dynamic = 'force-dynamic'

export async function GET() {
  const hardcodedGrades = [
    { id: '1', code: 'FC 200', name: 'Grey Cast Iron 200', c: '3.1-3.4', si: '1.8-2.2', mn: '0.6-0.9', p: '0.1 max', s: '0.1 max' },
    { id: '2', code: 'FC 250', name: 'Grey Cast Iron 250', c: '2.8-3.2', si: '1.5-2.0', mn: '0.6-0.9', p: '0.1 max', s: '0.1 max' },
    { id: '3', code: 'FC 300', name: 'Grey Cast Iron 300', c: '2.8-3.1', si: '1.3-1.7', mn: '0.8-1.2', p: '0.1 max', s: '0.1 max' },
    { id: '4', code: 'FC 350', name: 'Grey Cast Iron 350', c: '2.8-3.1', si: '1.2-1.6', mn: '0.8-1.2', p: '0.1 max', s: '0.1 max' },
    { id: '5', code: 'SG 400', name: 'Ductile Iron 400', c: '3.5-3.8', si: '2.2-2.8', mn: '0.3 max', p: '0.05 max', s: '0.02 max' },
    { id: '6', code: 'SG 500', name: 'Ductile Iron 500', c: '3.5-3.8', si: '2.0-2.6', mn: '0.3-0.6', p: '0.05 max', s: '0.02 max' },
    { id: '7', code: 'SG 600', name: 'Ductile Iron 600', c: '3.4-3.7', si: '1.8-2.4', mn: '0.4-0.7', p: '0.05 max', s: '0.02 max' },
  ]
  return NextResponse.json(hardcodedGrades)
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
