import type { SongSummary } from '../songs/songs.types.js';
import type { EventType } from './interactions.schemas.js';

export interface Interaction {
  id: string;
  userId: string;
  songId: string;
  eventType: EventType;
  listenedSeconds: number | null;
  createdAt: Date;
}

export interface SongWithTimestamp extends SongSummary {
  interactedAt: Date;
}
