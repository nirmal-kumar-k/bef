import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { eq, count, sql } from 'drizzle-orm'
import { db } from '@/infrastructure/database/client'
import { users } from '@/infrastructure/database/schema'
import { forgetSessionCache, getSessionUser, issueSession } from '@/shared/lib/auth'
import { passwordProblem } from '@/modules/users/domain/password'
import { publishOnSuccess } from '@/infrastructure/realtime/route-wrapper'
import { dbErrorResponse } from '@/infrastructure/database/db-error'

async function putHandler(
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
      const problem = passwordProblem(String(body.password))
      if (problem) return NextResponse.json({ error: problem }, { status: 400 })
      safeData.passwordHash = await bcrypt.hash(body.password, 10)
    }

    // A new password, a role change or deactivation ends every existing
    // session of this user: their old login tokens carry the old version.
    const [current] = await db.select({ role: users.role, isActive: users.isActive }).from(users).where(eq(users.id, id))
    const revoke = !!body.password
      || (safeData.role !== undefined && current && safeData.role !== current.role)
      || (safeData.isActive !== undefined && current && safeData.isActive !== current.isActive)
    if (revoke) safeData.sessionVersion = sql`${users.sessionVersion} + 1`

    const [row] = await db.update(users).set(safeData).where(eq(users.id, id)).returning({
      sessionVersion: users.sessionVersion,
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
    if (revoke) {
      forgetSessionCache(id)
      // Changing your OWN password/role would otherwise log you out mid-task:
      // re-issue this browser's session at the new version.
      if (id === session.id && row.isActive) await issueSession({ ...row, role: row.role, sessionVersion: row.sessionVersion })
    }
    const { sessionVersion: _sv, ...publicRow } = row
    return NextResponse.json(publicRow)
  } catch (error: any) {
    console.error('PUT /api/users/[id] error:', error)
    return dbErrorResponse(error, 'Failed to update user', { duplicate: 'A user with this username already exists' })
  }
}

async function deleteHandler(
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
    forgetSessionCache(id)
    if (!row) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('DELETE /api/users/[id] error:', error)
    return dbErrorResponse(error, 'Failed to delete user')
  }
}

// Tell other open screens about successful writes (see src/infrastructure/realtime).
export const PUT = publishOnSuccess('master', 'users', 'update', putHandler)
export const DELETE = publishOnSuccess('master', 'users', 'delete', deleteHandler)
