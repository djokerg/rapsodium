import 'dotenv/config';
import bcrypt from 'bcrypt';
import { drizzle } from 'drizzle-orm/node-postgres';
import { inArray, like, sql } from 'drizzle-orm';
import pg from 'pg';
import { interactions, songs, userPreferences, users } from './schema.js';

const NUM_USERS = 100;
const EMAIL_PREFIX = 'synthetic';
const EMAIL_DOMAIN = 'rapsodium.test';
const PASSWORD = 'synthetic';
const BCRYPT_ROUNDS = 12;

const GENRES = [
  'pop',
  'rock',
  'hip hop',
  'r&b',
  'electronic',
  'jazz',
  'classical',
  'latin',
  'metal',
  'country',
] as const;
type Genre = (typeof GENRES)[number];

const MIN_PREFS = 2;
const MAX_PREFS = 4;
const MIN_INTERACTIONS = 30;
const MAX_INTERACTIONS = 80;
const PREFERRED_SAMPLE_RATIO = 0.75;
const ACTIVITY_SPREAD_DAYS = 30;

type EventType = 'play' | 'skip' | 'save';

interface EventDraw {
  eventType: EventType;
  listenedSeconds: number | null;
}

const PREFERRED_DISTRIBUTION: Array<{
  probability: number;
  draw: () => EventDraw;
}> = [
  {
    probability: 0.2,
    draw: () => ({ eventType: 'save', listenedSeconds: null }),
  },
  {
    probability: 0.4,
    draw: () => ({ eventType: 'play', listenedSeconds: randInt(25, 30) }),
  },
  {
    probability: 0.25,
    draw: () => ({ eventType: 'play', listenedSeconds: randInt(8, 20) }),
  },
  {
    probability: 0.15,
    draw: () => ({ eventType: 'skip', listenedSeconds: randInt(0, 7) }),
  },
];

const NON_PREFERRED_DISTRIBUTION: Array<{
  probability: number;
  draw: () => EventDraw;
}> = [
  {
    probability: 0.02,
    draw: () => ({ eventType: 'save', listenedSeconds: null }),
  },
  {
    probability: 0.05,
    draw: () => ({ eventType: 'play', listenedSeconds: randInt(25, 30) }),
  },
  {
    probability: 0.25,
    draw: () => ({ eventType: 'play', listenedSeconds: randInt(8, 20) }),
  },
  {
    probability: 0.68,
    draw: () => ({ eventType: 'skip', listenedSeconds: randInt(0, 7) }),
  },
];

function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function sampleUnique<T>(arr: readonly T[], count: number): T[] {
  const copy = [...arr];
  const out: T[] = [];
  const n = Math.min(count, copy.length);
  for (let i = 0; i < n; i++) {
    const idx = randInt(0, copy.length - 1);
    out.push(copy[idx]);
    copy.splice(idx, 1);
  }
  return out;
}

function weightedPick<T>(
  dist: Array<{ probability: number; draw: () => T }>,
): T {
  const r = Math.random();
  let acc = 0;
  for (const entry of dist) {
    acc += entry.probability;
    if (r <= acc) return entry.draw();
  }
  return dist[dist.length - 1].draw();
}

function randomTimestampWithin(days: number): Date {
  const now = Date.now();
  const offset = Math.floor(Math.random() * days * 24 * 60 * 60 * 1000);
  return new Date(now - offset);
}

async function main(): Promise<void> {
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  const db = drizzle(pool);

  console.log('Clearing existing synthetic data...');
  await db
    .delete(users)
    .where(like(users.email, `${EMAIL_PREFIX}-%@${EMAIL_DOMAIN}`));

  console.log('Loading song catalog...');
  const allSongs = await db
    .select({ id: songs.id, genre: songs.genre })
    .from(songs);

  if (allSongs.length === 0) {
    console.error('No songs found. Run `npm run db:seed` first.');
    process.exit(1);
  }

  const songsByGenre = new Map<string, string[]>();
  for (const song of allSongs) {
    const list = songsByGenre.get(song.genre) ?? [];
    list.push(song.id);
    songsByGenre.set(song.genre, list);
  }

  console.log(
    `Catalog loaded: ${allSongs.length} songs across ${songsByGenre.size} genres`,
  );
  console.log(`Hashing password ("${PASSWORD}") for ${NUM_USERS} users...`);
  const passwordHash = await bcrypt.hash(PASSWORD, BCRYPT_ROUNDS);

  console.log(`Creating ${NUM_USERS} synthetic users...`);
  const createdUsers = await db
    .insert(users)
    .values(
      Array.from({ length: NUM_USERS }, (_, i) => ({
        email: `${EMAIL_PREFIX}-${i + 1}@${EMAIL_DOMAIN}`,
        passwordHash,
      })),
    )
    .returning({ id: users.id });

  const preferenceRows: { userId: string; genre: string }[] = [];
  const userPrefs: { userId: string; preferred: Set<Genre> }[] = [];

  for (const user of createdUsers) {
    const prefCount = randInt(MIN_PREFS, MAX_PREFS);
    const preferred = new Set<Genre>(sampleUnique(GENRES, prefCount));
    userPrefs.push({ userId: user.id, preferred });
    for (const genre of preferred) {
      preferenceRows.push({ userId: user.id, genre });
    }
  }

  console.log(`Inserting ${preferenceRows.length} user preferences...`);
  for (let i = 0; i < preferenceRows.length; i += 500) {
    await db.insert(userPreferences).values(preferenceRows.slice(i, i + 500));
  }

  console.log('Generating interactions...');
  const interactionRows: {
    userId: string;
    songId: string;
    eventType: string;
    listenedSeconds: number | null;
    createdAt: Date;
  }[] = [];

  const eventCounts: Record<EventType, number> = { play: 0, skip: 0, save: 0 };
  const touchedSongIds = new Set<string>();

  for (const { userId, preferred } of userPrefs) {
    const count = randInt(MIN_INTERACTIONS, MAX_INTERACTIONS);
    const preferredCount = Math.round(count * PREFERRED_SAMPLE_RATIO);
    const nonPreferredCount = count - preferredCount;

    const preferredSongPool: string[] = [];
    for (const g of preferred) {
      preferredSongPool.push(...(songsByGenre.get(g) ?? []));
    }
    const nonPreferredSongPool: string[] = [];
    for (const [genre, list] of songsByGenre) {
      if (!preferred.has(genre as Genre)) {
        nonPreferredSongPool.push(...list);
      }
    }

    const preferredPicks = sampleUnique(preferredSongPool, preferredCount);
    const nonPreferredPicks = sampleUnique(
      nonPreferredSongPool,
      nonPreferredCount,
    );

    for (const songId of preferredPicks) {
      const draw = weightedPick(PREFERRED_DISTRIBUTION);
      eventCounts[draw.eventType]++;
      touchedSongIds.add(songId);
      interactionRows.push({
        userId,
        songId,
        eventType: draw.eventType,
        listenedSeconds: draw.listenedSeconds,
        createdAt: randomTimestampWithin(ACTIVITY_SPREAD_DAYS),
      });
    }

    for (const songId of nonPreferredPicks) {
      const draw = weightedPick(NON_PREFERRED_DISTRIBUTION);
      eventCounts[draw.eventType]++;
      touchedSongIds.add(songId);
      interactionRows.push({
        userId,
        songId,
        eventType: draw.eventType,
        listenedSeconds: draw.listenedSeconds,
        createdAt: randomTimestampWithin(ACTIVITY_SPREAD_DAYS),
      });
    }
  }

  console.log(`Inserting ${interactionRows.length} interactions...`);
  for (let i = 0; i < interactionRows.length; i += 500) {
    await db
      .insert(interactions)
      .values(interactionRows.slice(i, i + 500))
      .onConflictDoNothing({
        target: [
          interactions.userId,
          interactions.songId,
          interactions.eventType,
        ],
        where: sql`event_type = 'save'`,
      });
  }

  const [{ interactionCount }] = await db
    .select({ interactionCount: sql<number>`count(*)::int` })
    .from(interactions)
    .where(
      inArray(
        interactions.userId,
        createdUsers.map((u) => u.id),
      ),
    );

  const coverage = (touchedSongIds.size / allSongs.length) * 100;
  const totalCells = NUM_USERS * allSongs.length;
  const density = (interactionCount / totalCells) * 100;

  console.log('');
  console.log('=== Synthetic data summary ===');
  console.log(`  Users:                      ${NUM_USERS}`);
  console.log(`  Preferences:                ${preferenceRows.length}`);
  console.log(`  Interactions (inserted):    ${interactionCount}`);
  console.log(`    play:                     ${eventCounts.play}`);
  console.log(`    skip:                     ${eventCounts.skip}`);
  console.log(`    save:                     ${eventCounts.save}`);
  console.log(
    `  Songs touched:              ${touchedSongIds.size} / ${allSongs.length} (${coverage.toFixed(1)}%)`,
  );
  console.log(`  Matrix density:             ${density.toFixed(2)}%`);
  console.log('');
  console.log('Login example:');
  console.log(`  email: ${EMAIL_PREFIX}-1@${EMAIL_DOMAIN}`);
  console.log(`  password: ${PASSWORD}`);

  await pool.end();
}

main().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
