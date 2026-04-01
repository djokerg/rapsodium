import 'dotenv/config';
import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import { songs } from './schema.js';
import { writeFileSync, existsSync, readFileSync } from 'fs';
import { resolve } from 'path';

const SEED_DATA_PATH = resolve(process.cwd(), 'seed-data.json');

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
];

const TRACKS_PER_GENRE = 50;

interface DeezerTrack {
  id: number;
  title: string;
  duration: number;
  preview: string;
  artist: { name: string };
  album: { title: string; cover_big: string };
}

interface DeezerSearchResponse {
  data: DeezerTrack[];
  total: number;
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

async function fetchDeezerTracks(
  genre: string,
  limit: number,
): Promise<SeedSong[]> {
  const url = `https://api.deezer.com/search?q=genre:"${encodeURIComponent(genre)}"&limit=${limit}`;

  const response = await fetch(url);

  if (!response.ok) {
    console.warn(`Failed to fetch genre "${genre}": ${response.status}`);
    return [];
  }

  const data = (await response.json()) as DeezerSearchResponse;

  if (!data.data) {
    console.warn(`No data for genre "${genre}"`);
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

  for (const genre of GENRES) {
    console.log(`Fetching "${genre}"...`);
    const tracks = await fetchDeezerTracks(genre, TRACKS_PER_GENRE);

    for (const track of tracks) {
      if (!seenIds.has(track.deezerId)) {
        seenIds.add(track.deezerId);
        allSongs.push(track);
      }
    }

    // Rate limit: Deezer allows 50 requests per 5 seconds
    await new Promise((resolve) => setTimeout(resolve, 300));
  }

  console.log(`Fetched ${allSongs.length} unique songs across ${GENRES.length} genres`);
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
    console.log(`  Inserted batch ${Math.ceil((i + 1) / BATCH_SIZE)} (${inserted}/${seedSongs.length})`);
  }

  console.log('Seed complete!');

  await pool.end();
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
