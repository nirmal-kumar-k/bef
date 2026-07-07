import { NextRequest, NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { db } from '@/infrastructure/database/client'
import { grades } from '@/infrastructure/database/schema'

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const [grade] = await db.update(grades).set(body).where(eq(grades.id, id)).returning()
    if (!grade) {
      return NextResponse.json({ error: 'Grade not found' }, { status: 404 })
    }
    return NextResponse.json(grade)
  } catch (error) {
    console.error('PUT /api/grades/[id] error:', error)
    return NextResponse.json({ error: 'Failed to update grade' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    await db.delete(grades).where(eq(grades.id, id))
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('DELETE /api/grades/[id] error:', error)
    return NextResponse.json({ error: 'Failed to delete grade' }, { status: 500 })
  }
}
