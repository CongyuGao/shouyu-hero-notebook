// Add Drizzle tables here when the site needs a database.
import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core';
export const editPassword = sqliteTable('edit_password', {
  id: text('id').primaryKey(),
  passwordHash: text('password_hash'),
  salt: text('salt'),
  revision: integer('revision').notNull().default(1),
  updatedAt: text('updated_at').notNull(),
  mutationId: text('mutation_id').notNull(),
});
export const editSessions = sqliteTable('edit_sessions', {
  tokenHash: text('token_hash').primaryKey(),
  passwordRevision: integer('password_revision').notNull(),
  expiresAt: text('expires_at').notNull(),
});
export const editAttempts = sqliteTable('edit_attempts', {
  id: text('id').primaryKey(),
  windowStart: integer('window_start').notNull(),
  attempts: integer('attempts').notNull(),
});
export const editLinks = sqliteTable('edit_links', {
  id: text('id').primaryKey(),
  tokenHash: text('token_hash'),
  revision: integer('revision').notNull().default(1),
  expiresAt: text('expires_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});
export const libraries = sqliteTable('libraries', {
  kind: text('kind').primaryKey(),
  itemsJson: text('items_json').notNull(),
  revision: integer('revision').notNull().default(1),
  updatedAt: text('updated_at').notNull(),
});
export const guides = sqliteTable('guides', {
  heroId: text('hero_id').primaryKey(),
  draftJson: text('draft_json').notNull(),
  publishedJson: text('published_json'),
  revision: integer('revision').notNull().default(1),
  updatedAt: text('updated_at').notNull(),
  publishedAt: text('published_at'),
  updatedBy: text('updated_by').notNull(),
  mutationId: text('mutation_id').notNull(),
});
export const editors = sqliteTable('editors', {
  email: text('email').primaryKey(),
  createdAt: text('created_at').notNull(),
});
export const revisions = sqliteTable(
  'revisions',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    heroId: text('hero_id').notNull(),
    revision: integer('revision').notNull(),
    snapshot: text('snapshot').notNull(),
    action: text('action').notNull(),
    createdAt: text('created_at').notNull(),
    author: text('author').notNull(),
  },
  (t) => [index('idx_revisions_hero').on(t.heroId, t.revision)],
);
