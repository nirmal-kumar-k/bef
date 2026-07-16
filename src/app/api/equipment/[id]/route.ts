import { NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { db } from '@/infrastructure/database/client'
import { equipment } from '@/infrastructure/database/schema'

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const data = await req.json()
    const { id } = await params

    // Partial update: only include fields the caller actually sent, so a
    // request that only touches e.g. heatSequence can't null out the rest of
    // the equipment record.
    const ALLOWED_FIELDS = new Set([
      'name', 'type', 'weightCapacity', 'firstHeatDurationMins', 'regularHeatDurationMins',
      'avgPiecesPerHour', 'restrictedCoreBoxes', 'heatSequence', 'isActive',
    ])
    const safeData: Record<string, any> = { updatedAt: new Date() }
    for (const [key, value] of Object.entries(data)) {
      if (ALLOWED_FIELDS.has(key) && value !== undefined) {
        safeData[key] = value
      }
    }

    const [row] = await db.update(equipment).set(safeData).where(eq(equipment.id, id)).returning()

    if (!row) {
      return NextResponse.json(
        { error: 'Equipment not found' },
        { status: 404 }
      )
    }

    return NextResponse.json(row)
  } catch (error) {
    console.error('Failed to update equipment:', error)
    return NextResponse.json(
      { error: 'Failed to update equipment' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const [row] = await db.delete(equipment).where(eq(equipment.id, id)).returning()

    if (!row) {
      return NextResponse.json(
        { error: 'Equipment not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Failed to delete equipment:', error)
    return NextResponse.json(
      { error: 'Failed to delete equipment' },
      { status: 500 }
    )
  }
}
