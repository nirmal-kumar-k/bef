import { pgTable, uuid, text, integer, jsonb, timestamp, index } from 'drizzle-orm/pg-core'

// One row per create/update/delete of a production plan or an order, written
// by the server in the same transaction as the change itself - so the history
// can never miss a change or disagree with the data. Who is taken from the
// session on the server, never from the request body.
//
// userId is deliberately not a foreign key and userName is a snapshot: the
// history must survive the user being renamed or deleted.
export const auditEvents = pgTable('audit_events', {
  id: uuid('id').primaryKey().defaultRandom(),
  at: timestamp('at').defaultNow().notNull(),
  userId: uuid('user_id'),
  userName: text('user_name'),
  entityType: text('entity_type').notNull(), // 'production_plan' | 'order'
  entityId: uuid('entity_id').notNull(),
  action: text('action').notNull(), // 'create' | 'update' | 'delete'
  // The record's version after this change (null for deletes) - lets a
  // conflict response list exactly the changes made since the caller loaded it.
  version: integer('version'),
  changedFields: text('changed_fields').array(),
  before: jsonb('before'),
  after: jsonb('after'),
}, (table) => [
  index('audit_events_entity_idx').on(table.entityType, table.entityId, table.at),
  index('audit_events_at_idx').on(table.at),
])
