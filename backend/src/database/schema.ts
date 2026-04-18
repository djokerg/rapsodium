import { sql } from 'drizzle-orm';
import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  integer,
  bigint,
  real,
  uniqueIndex,
} from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: uuid('id').defaultRandom().primaryKey(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const userPreferences = pgTable(
  'user_preferences',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    genre: varchar('genre', { length: 100 }).notNull(),
    weight: real('weight').notNull().default(1.0),
  },
  (table) => [
    uniqueIndex('user_preferences_user_genre_idx').on(table.userId, table.genre),
  ],
);

export const songs = pgTable(
  'songs',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    deezerId: bigint('deezer_id', { mode: 'number' }).notNull(),
    title: varchar('title', { length: 255 }).notNull(),
    artist: varchar('artist', { length: 255 }).notNull(),
    album: varchar('album', { length: 255 }),
    genre: varchar('genre', { length: 100 }).notNull(),
    durationSec: integer('duration_sec').notNull(),
    previewUrl: text('preview_url'),
    coverUrl: text('cover_url'),
    // Optional audio features for content-based recommendation (Phase 6)
    tempo: real('tempo'),
    energy: real('energy'),
    danceability: real('danceability'),
    valence: real('valence'),
  },
  (table) => [uniqueIndex('songs_deezer_id_idx').on(table.deezerId)],
);

export const interactions = pgTable(
  'interactions',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    songId: uuid('song_id')
      .notNull()
      .references(() => songs.id, { onDelete: 'cascade' }),
    eventType: varchar('event_type', { length: 20 }).notNull(),
    listenedSeconds: integer('listened_seconds'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('interactions_toggle_unique_idx')
      .on(table.userId, table.songId, table.eventType)
      .where(sql`event_type in ('like', 'save', 'dislike')`),
  ],
);
