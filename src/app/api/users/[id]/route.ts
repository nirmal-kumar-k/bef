import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { eq, count } from 'drizzle-orm'
import { db } from '@/infrastructure/database/client'
import { users } from '@/infrastructure/database/schema'
import { getSessionUser } from '@/shared/lib/auth'

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSessionUser()
  if (!session || session.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const { id } = await params
    const body = await request.json()

    // Partial update: only touch fields the caller actually sent. Password is
    // only rehashed when a new one is provided - this is also how an admin
    // resets someone's password today, in place of the OTP flow.
    const ALLOWED_FIELDS = new Set(['name', 'username', 'phone', 'role', 'isActive'])
    const safeData: Record<string, any> = { updatedAt: new Date() }
    for (const [key, value] of Object.entries(body)) {
      if (ALLOWED_FIELDS.has(key) && value !== undefined) {
        safeData[key] = value
      }
    }
    if (body.password) {
      safeData.passwordHash = await bcrypt.hash(body.password, 10)
    }

    const [row] = await db.update(users).set(safeData).where(eq(users.id, id)).returning({
      id: users.id,
      name: users.name,
      username: users.username,
      phone: users.phone,
      role: users.role,
      isActive: users.isActive,
      createdAt: users.createdAt,
    })

    if (!row) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }
    return NextResponse.json(row)
  } catch (error: any) {
    console.error('PUT /api/users/[id] error:', error)
    const message = error?.code === '23505' ? 'A user with this username already exists' : 'Failed to update user'
    return NextResponse.json({ error: message }, { status: error?.code === '23505' ? 409 : 500 })
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSessionUser()
  if (!session || session.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const { id } = await params

    if (id === session.id) {
      return NextResponse.json({ error: 'You cannot delete your own account' }, { status: 400 })
    }

    const [target] = await db.select({ role: users.role }).from(users).where(eq(users.id, id))
    if (target?.role === 'admin') {
      const [{ value: adminCount }] = await db.select({ value: count() }).from(users).where(eq(users.role, 'admin'))
      if (adminCount <= 1) {
        return NextResponse.json({ error: 'Cannot delete the last remaining admin' }, { status: 400 })
      }
    }

    const [row] = await db.delete(users).where(eq(users.id, id)).returning()
    if (!row) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('DELETE /api/users/[id] error:', error)
    return NextResponse.json({ error: 'Failed to delete user' }, { status: 500 })
  }
}
