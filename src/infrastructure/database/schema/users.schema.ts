import { pgTable, uuid, text, timestamp, pgEnum, boolean } from 'drizzle-orm/pg-core'

export const userRoleEnum = pgEnum('user_role', ['admin', 'manager', 'operator'])

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  username: text('username').notNull().unique(),
  phone: text('phone'),
  // Kept optional for backward compatibility with the original email-based
  // bootstrap account; no longer used for login (username is the identifier).
  email: text('email').unique(),
  passwordHash: text('password_hash').notNull(),
  role: userRoleEnum('role').default('operator').notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})
