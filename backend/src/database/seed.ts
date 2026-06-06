import 'dotenv/config';
import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import { songs } from './schema.js';
import { writeFileSync, existsSync, readFileSync } from 'fs';
import { resolve } from 'path';

const SEED_DATA_PATH = resolve(process.cwd(), 'seed-data.json');

// Deezer genre IDs (from https://api.deezer.com/genre).
// Used with /chart/{id}/tracks to fetch the most popular tracks per genre.
// Note: this endpoint is geo-IP localized, so the chart reflects what's
// popular in the seeder's region — that's intentional here, since we want
// songs Serbian test users will recognize.
const GENRES: Record<string, number> = {
  pop: 132,
  rock: 152,
  'hip hop': 116,
  'r&b': 165,
  electronic: 106,
  jazz: 129,
  classical: 98,
  latin: 197,
  metal: 464,
  country: 84,
};

const TRACKS_PER_GENRE = 50;

interface DeezerTrack {
  id: number;
  title: string;
  duration: number;
  preview: string;
  artist: { name: string };
  album: { title: string; cover_big: string };
}

interface DeezerChartResponse {
  data?: DeezerTrack[];
  total?: number;
}

interface SeedSong {
  deezerId: number;
  title: string;
  artist: string;
  album: string;
  genre: string;
  durationSec: number;
  previewUrl: string;
  coverUrl: string;
}

async function fetchTopTracksForGenre(
  genre: string,
  genreId: number,
  limit: number,
): Promise<SeedSong[]> {
  const url = `https://api.deezer.com/chart/${genreId}/tracks?limit=${limit}`;

  const response = await fetch(url);

  if (!response.ok) {
    console.warn(`Failed to fetch chart for "${genre}": ${response.status}`);
    return [];
  }

  const data = (await response.json()) as DeezerChartResponse;

  if (!data.data) {
    console.warn(`No chart data for genre "${genre}"`);
    return [];
  }

  return data.data
    .filter((track) => track.preview && track.preview.length > 0)
    .map((track) => ({
      deezerId: track.id,
      title: track.title,
      artist: track.artist.name,
      album: track.album.title,
      genre,
      durationSec: track.duration,
      previewUrl: track.preview,
      coverUrl: track.album.cover_big,
    }));
}

async function fetchAllSongs(): Promise<SeedSong[]> {
  const allSongs: SeedSong[] = [];
  const seenIds = new Set<number>();
  const genreEntries = Object.entries(GENRES);

  for (const [genre, genreId] of genreEntries) {
    console.log(`Fetching top "${genre}" tracks...`);
    const tracks = await fetchTopTracksForGenre(
      genre,
      genreId,
      TRACKS_PER_GENRE,
    );

    for (const track of tracks) {
      if (!seenIds.has(track.deezerId)) {
        seenIds.add(track.deezerId);
        allSongs.push(track);
      }
    }

    // Rate limit: Deezer allows 50 requests per 5 seconds
    await new Promise((resolve) => setTimeout(resolve, 300));
  }

  console.log(
    `Fetched ${allSongs.length} unique songs across ${genreEntries.length} genres`,
  );
  return allSongs;
}

async function seed(): Promise<void> {
  let seedSongs: SeedSong[];

  // Use cached seed data if available, otherwise fetch from Deezer
  if (existsSync(SEED_DATA_PATH)) {
    console.log('Loading songs from cached seed-data.json...');
    const raw = readFileSync(SEED_DATA_PATH, 'utf-8');
    seedSongs = JSON.parse(raw) as SeedSong[];
    console.log(`Loaded ${seedSongs.length} songs from cache`);
  } else {
    console.log('Fetching songs from Deezer API...');
    seedSongs = await fetchAllSongs();

    writeFileSync(SEED_DATA_PATH, JSON.stringify(seedSongs, null, 2));
    console.log(`Saved ${seedSongs.length} songs to seed-data.json`);
  }

  if (seedSongs.length === 0) {
    console.error('No songs to seed');
    process.exit(1);
  }

  const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
  });

  const db = drizzle(pool);

  console.log('Inserting songs into database...');

  // Insert in batches of 50
  const BATCH_SIZE = 50;
  let inserted = 0;

  for (let i = 0; i < seedSongs.length; i += BATCH_SIZE) {
    const batch = seedSongs.slice(i, i + BATCH_SIZE);

    await db
      .insert(songs)
      .values(
        batch.map((s) => ({
          deezerId: s.deezerId,
          title: s.title,
          artist: s.artist,
          album: s.album,
          genre: s.genre,
          durationSec: s.durationSec,
          previewUrl: s.previewUrl,
          coverUrl: s.coverUrl,
        })),
      )
      .onConflictDoNothing({ target: songs.deezerId });

    inserted += batch.length;
    console.log(
      `  Inserted batch ${Math.ceil((i + 1) / BATCH_SIZE)} (${inserted}/${seedSongs.length})`,
    );
  }

  console.log('Seed complete!');

  await pool.end();
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
