import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { asc } from 'drizzle-orm'
import { db } from '@/infrastructure/database/client'
import { users } from '@/infrastructure/database/schema'
import { getSessionUser } from '@/shared/lib/auth'

export const dynamic = 'force-dynamic'

export async function GET() {
  const session = await getSessionUser()
  if (!session || session.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const rows = await db.select({
      id: users.id,
      name: users.name,
      username: users.username,
      phone: users.phone,
      role: users.role,
      isActive: users.isActive,
      createdAt: users.createdAt,
    }).from(users).orderBy(asc(users.name))
    return NextResponse.json(rows)
  } catch (error) {
    console.error('GET /api/users error:', error)
    return NextResponse.json({ error: 'Failed to fetch users' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const session = await getSessionUser()
  if (!session || session.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const body = await request.json()
    if (!body.name || !body.username || !body.password) {
      return NextResponse.json({ error: 'Name, username, and password are required' }, { status: 400 })
    }

    const passwordHash = await bcrypt.hash(body.password, 10)
    const [row] = await db.insert(users).values({
      name: body.name,
      username: body.username,
      phone: body.phone || null,
      passwordHash,
      role: body.role || 'operator',
      isActive: body.isActive ?? true,
    }).returning({
      id: users.id,
      name: users.name,
      username: users.username,
      phone: users.phone,
      role: users.role,
      isActive: users.isActive,
      createdAt: users.createdAt,
    })

    return NextResponse.json(row, { status: 201 })
  } catch (error: any) {
    console.error('POST /api/users error:', error)
    const message = error?.code === '23505' ? 'A user with this username already exists' : 'Failed to create user'
    return NextResponse.json({ error: message }, { status: error?.code === '23505' ? 409 : 500 })
  }
}
