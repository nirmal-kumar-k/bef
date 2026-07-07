import { pgTable, uuid, text, integer, numeric, boolean, jsonb, timestamp } from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'

export const patterns = pgTable('patterns', {
  id: uuid('id').primaryKey().defaultRandom(),
  code: text('code').notNull(),
  name: text('name').notNull(),
  customer: text('customer').default(''),
  category: text('category').default('Machine Moulding'),
  goodWeight: numeric('good_weight').default('0'),
  runnerRiserWeight: numeric('runner_riser_weight').default('0'),
  totalWeight: numeric('total_weight').default('0'),
  topMatchplate: boolean('top_matchplate').default(false),
  bottomMatchplate: boolean('bottom_matchplate').default(false),
  coreBoxes: integer('core_boxes').default(0),
  topOwner: text('top_owner').default('Customer'),
  topImages: jsonb('top_images').$type<string[]>().default([]),
  bottomOwner: text('bottom_owner').default('Customer'),
  bottomImages: jsonb('bottom_images').$type<string[]>().default([]),
  avgMouldsPerHour: numeric('avg_moulds_per_hour'),
  patternImages: jsonb('pattern_images').$type<string[]>().default([]),
  remarks: text('remarks').default(''),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

// Mirrors IPattern.sharedCoreBoxes
export const patternCoreBoxes = pgTable('pattern_core_boxes', {
  id: uuid('id').primaryKey().defaultRandom(),
  patternId: uuid('pattern_id').notNull().references(() => patterns.id, { onDelete: 'cascade' }),
  code: text('code').default(''),
  owner: text('owner').default('Foundry'),
  images: jsonb('images').$type<string[]>().default([]),
  typeOfCore: text('type_of_core'),
  coreWeight: numeric('core_weight'),
  avgCoreProduction: text('avg_core_production'),
})

// Mirrors IPattern.mappedProducts (selectedCoreBoxes kept as jsonb: small, references core box by code)
export const patternProducts = pgTable('pattern_products', {
  id: uuid('id').primaryKey().defaultRandom(),
  patternId: uuid('pattern_id').notNull().references(() => patterns.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  cavities: integer('cavities').default(1),
  selectedCoreBoxes: jsonb('selected_core_boxes')
    .$type<{ coreBoxId?: string; coreBoxCode: string; quantity: number }[]>()
    .default([]),
})

export const patternsRelations = relations(patterns, ({ many }) => ({
  sharedCoreBoxes: many(patternCoreBoxes),
  mappedProducts: many(patternProducts),
}))

export const patternCoreBoxesRelations = relations(patternCoreBoxes, ({ one }) => ({
  pattern: one(patterns, { fields: [patternCoreBoxes.patternId], references: [patterns.id] }),
}))

export const patternProductsRelations = relations(patternProducts, ({ one }) => ({
  pattern: one(patterns, { fields: [patternProducts.patternId], references: [patterns.id] }),
}))
