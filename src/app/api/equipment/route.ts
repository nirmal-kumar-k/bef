import { NextResponse } from 'next/server'
import { asc } from 'drizzle-orm'
import { db } from '@/infrastructure/database/client'
import { equipment } from '@/infrastructure/database/schema'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const rows = await db.select().from(equipment).orderBy(asc(equipment.type), asc(equipment.name))
    return NextResponse.json(rows)
  } catch (error) {
    console.error('Failed to fetch equipment:', error)
    return NextResponse.json(
      { error: 'Failed to fetch equipment' },
      { status: 500 }
    )
  }
}

export async function POST(req: Request) {
  try {
    const data = await req.json()
    const safeData = {
      name: data.name,
      type: data.type,
      weightCapacity: data.weightCapacity,
      firstHeatDurationMins: data.firstHeatDurationMins,
      regularHeatDurationMins: data.regularHeatDurationMins,
      avgPiecesPerHour: data.avgPiecesPerHour,
      restrictedCoreBoxes: data.restrictedCoreBoxes,
      isActive: data.isActive,
    }
    const [row] = await db.insert(equipment).values(safeData).returning()
    return NextResponse.json(row)
  } catch (error) {
    console.error('Failed to create equipment:', error)
    return NextResponse.json(
      { error: 'Failed to create equipment' },
      { status: 500 }
    )
  }
}
