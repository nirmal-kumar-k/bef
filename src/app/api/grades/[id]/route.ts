import { NextRequest, NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { db } from '@/infrastructure/database/client'
import { grades } from '@/infrastructure/database/schema'
import { publishOnSuccess } from '@/infrastructure/realtime/route-wrapper'
import { dbErrorResponse } from '@/infrastructure/database/db-error'

async function putHandler(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    // Strip system-managed fields so a caller spreading a previously-fetched
    // record (id, createdAt/updatedAt as JSON strings) can't crash the
    // timestamp columns or overwrite the id.
    const { id: _id, createdAt: _createdAt, updatedAt: _updatedAt, ...rest } = body
    const updateData: Record<string, any> = { updatedAt: new Date() }
    for (const [key, value] of Object.entries(rest)) {
      if (value !== undefined) updateData[key] = value
    }
    const [grade] = await db.update(grades).set(updateData).where(eq(grades.id, id)).returning()
    if (!grade) {
      return NextResponse.json({ error: 'Grade not found' }, { status: 404 })
    }
    return NextResponse.json(grade)
  } catch (error) {
    console.error('PUT /api/grades/[id] error:', error)
    return dbErrorResponse(error, 'Failed to update grade')
  }
}

async function deleteHandler(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    await db.delete(grades).where(eq(grades.id, id))
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('DELETE /api/grades/[id] error:', error)
    return dbErrorResponse(error, 'Failed to delete grade')
  }
}

// Tell other open screens about successful writes (see src/infrastructure/realtime).
export const PUT = publishOnSuccess('master', 'grades', 'update', putHandler)
export const DELETE = publishOnSuccess('master', 'grades', 'delete', deleteHandler)
