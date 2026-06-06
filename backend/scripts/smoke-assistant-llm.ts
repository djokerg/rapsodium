/**
 * Live smoke test for the assistant LLM layer (tool calling + structured output).
 * Uses the real OPENAI_API_KEY from backend/.env, with a STUBBED catalog so it
 * needs neither the database nor the recommender. Run from backend/:
 *   npx tsx scripts/smoke-assistant-llm.ts
 */
import 'dotenv/config';
import type { ConfigService } from '@nestjs/config';
import { LlmService, type ToolExecutor } from '../src/assistant/llm.service.js';
import { EMPTY_VIBE_PROFILE } from '../src/assistant/types.js';

const config = {
  getOrThrow: (key: string): string => {
    const value = process.env[key];
    if (!value) throw new Error(`Missing env ${key}`);
    return value;
  },
  get: (key: string): string | undefined => process.env[key],
} as unknown as ConfigService;

// Pretend Metallica is in the catalogue but Rammstein is not.
const executor: ToolExecutor = (name, args) => {
  const query = typeof args.query === 'string' ? args.query.toLowerCase() : '';
  console.log(`   ↳ tool ${name}(${JSON.stringify(args)})`);
  if (query.includes('metallica')) {
    return Promise.resolve({
      query,
      artists: ['Metallica'],
      genres: ['Metal'],
      matches: [
        { title: 'Enter Sandman', artist: 'Metallica', genre: 'Metal' },
      ],
    });
  }
  // Generic: report the genres that exist, no matching artist.
  return Promise.resolve({
    query,
    artists: [],
    genres: ['Pop', 'Rock', 'Metal', 'Hip-Hop'],
    matches: [],
  });
};

const prompts = [
  'I am studying, something calm in the background but not too mainstream',
  'play some Rammstein',
  'more like Metallica',
];

async function main(): Promise<void> {
  const llm = new LlmService(config);
  for (const prompt of prompts) {
    console.log(`\nUSER: ${prompt}`);
    try {
      const turn = await llm.extract(EMPTY_VIBE_PROFILE, prompt, executor);
      console.log(`REPLY: ${turn.assistantReply}`);
      console.log(`PATCH: ${JSON.stringify(turn.patch)}`);
    } catch (err) {
      console.error('FAILED:', err instanceof Error ? err.message : err);
    }
  }
}

void main();
