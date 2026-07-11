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

    // Clean data before DB update
    const safeData = {
      name: data.name,
      type: data.type,
      weightCapacity: data.weightCapacity,
      firstHeatDurationMins: data.firstHeatDurationMins,
      regularHeatDurationMins: data.regularHeatDurationMins,
      avgPiecesPerHour: data.avgPiecesPerHour,
      restrictedCoreBoxes: data.restrictedCoreBoxes,
      isActive: data.isActive,
      updatedAt: new Date(),
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
