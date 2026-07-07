import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from './schema'

const DATABASE_URL = process.env.DATABASE_URL

if (!DATABASE_URL) {
  throw new Error('Please define the DATABASE_URL environment variable inside .env.local')
}

// Cached across hot reloads in dev to avoid exhausting connections.
const globalForDb = global as unknown as { postgresClient?: postgres.Sql }

const client = globalForDb.postgresClient ?? postgres(DATABASE_URL, { prepare: false })

if (process.env.NODE_ENV !== 'production') {
  globalForDb.postgresClient = client
}

export const db = drizzle(client, { schema })
