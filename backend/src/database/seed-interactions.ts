import 'dotenv/config';
import bcrypt from 'bcrypt';
import { drizzle } from 'drizzle-orm/node-postgres';
import { inArray, like, sql } from 'drizzle-orm';
import pg from 'pg';
import { interactions, songs, userPreferences, users } from './schema.js';

// Reproducibility: a fixed seed makes the synthetic dataset (and therefore the
// offline evaluation in the recommender) deterministic. Override with SEED=...
const SEED = process.env.SEED ?? 'rapsodium-eval';
const NUM_USERS = Number(process.env.NUM_USERS ?? 100);
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
const ACTIVITY_SPREAD_DAYS = 90;

// Audio-feature space. Tempo is normalized to [0, 1] so all four dimensions
// contribute equally to taste distance (mirrors the recommender's MinMaxScaler).
const TEMPO_MIN = 60;
const TEMPO_MAX = 200;
type Vec = readonly [number, number, number, number];
const DEFAULT_VEC: Vec = [
  (110 - TEMPO_MIN) / (TEMPO_MAX - TEMPO_MIN),
  0.6,
  0.6,
  0.6,
];

// Spread of a user's personal taste around their genres' centroid, and the
// width of the affinity kernel that converts taste-distance into a 0–1 weight.
const TASTE_OFFSET_STD = 0.12;
const AFFINITY_SIGMA = 0.4;

type EventType = 'play' | 'skip' | 'save';

interface EventDraw {
  eventType: EventType;
  listenedSeconds: number | null;
}

interface SongRow {
  id: string;
  genre: string;
  tempo: number | null;
  energy: number | null;
  danceability: number | null;
  valence: number | null;
}

// --- seeded RNG --------------------------------------------------------------

function hashString(value: string): number {
  let h = 2166136261;
  for (let i = 0; i < value.length; i++) {
    h ^= value.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** mulberry32 — small, fast, well-distributed seeded PRNG returning [0, 1). */
function makeRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rng = makeRng(hashString(String(SEED)));

function randInt(min: number, max: number): number {
  return Math.floor(rng() * (max - min + 1)) + min;
}

/** Standard-normal sample via Box–Muller, driven by the seeded RNG. */
function gaussian(): number {
  const u = 1 - rng();
  const v = rng();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

function clip(value: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, value));
}

// --- sampling helpers --------------------------------------------------------

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

/**
 * Sample `count` distinct items with probability proportional to `weights`
 * (weighted reservoir-free roulette without replacement). Falls back to a
 * uniform pick once the remaining weights sum to zero.
 */
function weightedSampleUnique(
  items: readonly string[],
  weights: readonly number[],
  count: number,
): string[] {
  const pool = items.map((_, i) => i);
  const out: string[] = [];
  const n = Math.min(count, pool.length);

  for (let k = 0; k < n; k++) {
    let total = 0;
    for (const idx of pool) total += weights[idx];

    let chosen: number;
    if (total <= 0) {
      chosen = randInt(0, pool.length - 1);
    } else {
      let r = rng() * total;
      chosen = pool.length - 1;
      for (let p = 0; p < pool.length; p++) {
        r -= weights[pool[p]];
        if (r <= 0) {
          chosen = p;
          break;
        }
      }
    }
    out.push(items[pool[chosen]]);
    pool.splice(chosen, 1);
  }
  return out;
}

// --- audio-feature taste model ----------------------------------------------

function normTempo(tempo: number): number {
  return clip((tempo - TEMPO_MIN) / (TEMPO_MAX - TEMPO_MIN), 0, 1);
}

function computeGenreCentroids(rows: readonly SongRow[]): Map<string, Vec> {
  const acc = new Map<
    string,
    { sum: [number, number, number, number]; count: number }
  >();
  for (const r of rows) {
    if (
      r.tempo === null ||
      r.energy === null ||
      r.danceability === null ||
      r.valence === null
    ) {
      continue;
    }
    const cur = acc.get(r.genre) ?? { sum: [0, 0, 0, 0], count: 0 };
    cur.sum[0] += normTempo(r.tempo);
    cur.sum[1] += r.energy;
    cur.sum[2] += r.danceability;
    cur.sum[3] += r.valence;
    cur.count += 1;
    acc.set(r.genre, cur);
  }

  const out = new Map<string, Vec>();
  for (const [genre, { sum, count }] of acc) {
    out.set(genre, [
      sum[0] / count,
      sum[1] / count,
      sum[2] / count,
      sum[3] / count,
    ]);
  }
  return out;
}

function songVector(row: SongRow, centroid: Vec): Vec {
  return [
    row.tempo === null ? centroid[0] : normTempo(row.tempo),
    row.energy ?? centroid[1],
    row.danceability ?? centroid[2],
    row.valence ?? centroid[3],
  ];
}

function userTaste(
  preferred: ReadonlySet<Genre>,
  centroids: Map<string, Vec>,
): Vec {
  const acc: [number, number, number, number] = [0, 0, 0, 0];
  let n = 0;
  for (const genre of preferred) {
    const c = centroids.get(genre);
    if (c) {
      acc[0] += c[0];
      acc[1] += c[1];
      acc[2] += c[2];
      acc[3] += c[3];
      n += 1;
    }
  }
  const base: Vec =
    n > 0 ? [acc[0] / n, acc[1] / n, acc[2] / n, acc[3] / n] : DEFAULT_VEC;
  // Each user sits at a personal point near their genres' centroid, so two fans
  // of the same genre still have distinguishable taste (signal for CF/content).
  return [
    clip(base[0] + gaussian() * TASTE_OFFSET_STD, 0, 1),
    clip(base[1] + gaussian() * TASTE_OFFSET_STD, 0, 1),
    clip(base[2] + gaussian() * TASTE_OFFSET_STD, 0, 1),
    clip(base[3] + gaussian() * TASTE_OFFSET_STD, 0, 1),
  ];
}

function affinity(taste: Vec, song: Vec): number {
  let d2 = 0;
  for (let i = 0; i < 4; i++) {
    const diff = taste[i] - song[i];
    d2 += diff * diff;
  }
  return Math.exp(-d2 / (2 * AFFINITY_SIGMA * AFFINITY_SIGMA));
}

// --- event model -------------------------------------------------------------

// Preferred songs: the closer a song is to the user's taste, the likelier a save
// (strong positive) and the less likely a skip. This is the structure the
// personalized recommenders are meant to recover.
function drawPreferredEvent(aff: number): EventDraw {
  const r = rng();
  const saveP = 0.12 + 0.33 * aff; // 0.12 .. 0.45
  if (r < saveP) return { eventType: 'save', listenedSeconds: null };
  if (r < saveP + 0.3)
    return { eventType: 'play', listenedSeconds: randInt(25, 30) };
  if (r < saveP + 0.55)
    return { eventType: 'play', listenedSeconds: randInt(8, 20) };
  return { eventType: 'skip', listenedSeconds: randInt(0, 7) };
}

// Non-preferred songs: mostly skips, the occasional surprise hit.
function drawNonPreferredEvent(): EventDraw {
  const r = rng();
  if (r < 0.02) return { eventType: 'save', listenedSeconds: null };
  if (r < 0.07) return { eventType: 'play', listenedSeconds: randInt(25, 30) };
  if (r < 0.32) return { eventType: 'play', listenedSeconds: randInt(8, 20) };
  return { eventType: 'skip', listenedSeconds: randInt(0, 7) };
}

function randomTimestampWithin(days: number): Date {
  const now = Date.now();
  const offset = Math.floor(rng() * days * 24 * 60 * 60 * 1000);
  return new Date(now - offset);
}

async function main(): Promise<void> {
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  const db = drizzle(pool);

  console.log(`Seed: "${String(SEED)}" | users: ${NUM_USERS}`);
  console.log('Clearing existing synthetic data...');
  await db
    .delete(users)
    .where(like(users.email, `${EMAIL_PREFIX}-%@${EMAIL_DOMAIN}`));

  console.log('Loading song catalog (with audio features)...');
  const allSongs: SongRow[] = await db
    .select({
      id: songs.id,
      genre: songs.genre,
      tempo: songs.tempo,
      energy: songs.energy,
      danceability: songs.danceability,
      valence: songs.valence,
    })
    .from(songs);

  if (allSongs.length === 0) {
    console.error('No songs found. Run `npm run db:seed` first.');
    process.exit(1);
  }

  const withFeatures = allSongs.filter((s) => s.tempo !== null).length;
  if (withFeatures === 0) {
    console.warn(
      'WARNING: no songs have audio features. Run `poetry run seed-audio-features` ' +
        'in the recommender first, or taste structure falls back to genre only.',
    );
  }

  const centroids = computeGenreCentroids(allSongs);
  const songVecById = new Map<string, Vec>();
  const songsByGenre = new Map<string, string[]>();
  for (const song of allSongs) {
    const centroid = centroids.get(song.genre) ?? DEFAULT_VEC;
    songVecById.set(song.id, songVector(song, centroid));
    const list = songsByGenre.get(song.genre) ?? [];
    list.push(song.id);
    songsByGenre.set(song.genre, list);
  }

  console.log(
    `Catalog loaded: ${allSongs.length} songs across ${songsByGenre.size} genres ` +
      `(${withFeatures} with audio features)`,
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
  const userPrefs: { userId: string; preferred: Set<Genre>; taste: Vec }[] = [];

  for (const user of createdUsers) {
    const prefCount = randInt(MIN_PREFS, MAX_PREFS);
    const preferred = new Set<Genre>(sampleUnique(GENRES, prefCount));
    userPrefs.push({
      userId: user.id,
      preferred,
      taste: userTaste(preferred, centroids),
    });
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
  const savesPerUser: number[] = [];

  for (const { userId, preferred, taste } of userPrefs) {
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

    // Bias preferred picks toward songs near the user's taste vector.
    const preferredWeights = preferredSongPool.map((id) =>
      affinity(taste, songVecById.get(id) ?? DEFAULT_VEC),
    );
    const preferredPicks = weightedSampleUnique(
      preferredSongPool,
      preferredWeights,
      preferredCount,
    );
    const nonPreferredPicks = sampleUnique(
      nonPreferredSongPool,
      nonPreferredCount,
    );

    let userSaves = 0;
    for (const songId of preferredPicks) {
      const aff = affinity(taste, songVecById.get(songId) ?? DEFAULT_VEC);
      const draw = drawPreferredEvent(aff);
      eventCounts[draw.eventType]++;
      if (draw.eventType === 'save') userSaves++;
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
      const draw = drawNonPreferredEvent();
      eventCounts[draw.eventType]++;
      if (draw.eventType === 'save') userSaves++;
      touchedSongIds.add(songId);
      interactionRows.push({
        userId,
        songId,
        eventType: draw.eventType,
        listenedSeconds: draw.listenedSeconds,
        createdAt: randomTimestampWithin(ACTIVITY_SPREAD_DAYS),
      });
    }

    savesPerUser.push(userSaves);
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
  const usersWithSaves = savesPerUser.filter((n) => n > 0).length;
  const avgSaves = savesPerUser.reduce((a, b) => a + b, 0) / (NUM_USERS || 1);

  console.log('');
  console.log('=== Synthetic data summary ===');
  console.log(`  Users:                      ${NUM_USERS}`);
  console.log(`  Preferences:                ${preferenceRows.length}`);
  console.log(`  Interactions (inserted):    ${interactionCount}`);
  console.log(`    play:                     ${eventCounts.play}`);
  console.log(`    skip:                     ${eventCounts.skip}`);
  console.log(`    save:                     ${eventCounts.save}`);
  console.log(
    `  Users with >=1 save:        ${usersWithSaves} / ${NUM_USERS} ` +
      `(avg ${avgSaves.toFixed(1)} saves/user)`,
  );
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

main().catch((err: unknown) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
