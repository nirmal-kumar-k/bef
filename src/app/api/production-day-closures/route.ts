import { NextRequest, NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { db } from '@/infrastructure/database/client'
import { productionDayClosures } from '@/infrastructure/database/schema'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const date = request.nextUrl.searchParams.get('date')
    if (!date) return NextResponse.json({ error: 'date query param is required' }, { status: 400 })
    const [row] = await db.select().from(productionDayClosures).where(eq(productionDayClosures.date, date))
    return NextResponse.json({ closed: !!row })
  } catch (error) {
    console.error('GET /api/production-day-closures error:', error)
    return NextResponse.json({ error: 'Failed to fetch closure status' }, { status: 500 })
  }
}
