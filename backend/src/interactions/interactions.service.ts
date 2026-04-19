import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { and, count, countDistinct, desc, eq, max } from 'drizzle-orm';
import { DATABASE, type Database } from '../database/database.module.js';
import { interactions, songs } from '../database/schema.js';
import type { PaginatedResult } from '../songs/songs.types.js';
import {
  isToggleEvent,
  type CreateInteractionDto,
  type EventType,
  type ToggleEventType,
} from './interactions.schemas.js';
import type { Interaction, SongWithTimestamp } from './interactions.types.js';

interface InteractionRow {
  id: string;
  userId: string;
  songId: string;
  eventType: string;
  listenedSeconds: number | null;
  createdAt: Date;
}

function rowToInteraction(row: InteractionRow): Interaction {
  return {
    id: row.id,
    userId: row.userId,
    songId: row.songId,
    eventType: row.eventType as EventType,
    listenedSeconds: row.listenedSeconds,
    createdAt: row.createdAt,
  };
}

const songSummaryColumns = {
  id: songs.id,
  title: songs.title,
  artist: songs.artist,
  album: songs.album,
  genre: songs.genre,
  durationSec: songs.durationSec,
  coverUrl: songs.coverUrl,
} as const;

@Injectable()
export class InteractionsService {
  constructor(@Inject(DATABASE) private readonly db: Database) {}

  async create(userId: string, dto: CreateInteractionDto): Promise<Interaction> {
    const [song] = await this.db
      .select({ id: songs.id })
      .from(songs)
      .where(eq(songs.id, dto.songId))
      .limit(1);

    if (!song) {
      throw new NotFoundException('Song not found');
    }

    if (isToggleEvent(dto.eventType)) {
      const [existing] = await this.db
        .select()
        .from(interactions)
        .where(
          and(
            eq(interactions.userId, userId),
            eq(interactions.songId, dto.songId),
            eq(interactions.eventType, dto.eventType),
          ),
        )
        .limit(1);

      if (existing) {
        return rowToInteraction(existing);
      }
    }

    const [row] = await this.db
      .insert(interactions)
      .values({
        userId,
        songId: dto.songId,
        eventType: dto.eventType,
        listenedSeconds: dto.listenedSeconds ?? null,
      })
      .returning();

    return rowToInteraction(row);
  }

  async remove(
    userId: string,
    songId: string,
    eventType: ToggleEventType,
  ): Promise<void> {
    await this.db
      .delete(interactions)
      .where(
        and(
          eq(interactions.userId, userId),
          eq(interactions.songId, songId),
          eq(interactions.eventType, eventType),
        ),
      );
  }

  async getFavorites(
    userId: string,
    page: number,
    limit: number,
  ): Promise<PaginatedResult<SongWithTimestamp>> {
    const offset = (page - 1) * limit;
    const where = and(
      eq(interactions.userId, userId),
      eq(interactions.eventType, 'save'),
    );

    const [data, totalRows] = await Promise.all([
      this.db
        .select({
          ...songSummaryColumns,
          interactedAt: interactions.createdAt,
        })
        .from(interactions)
        .innerJoin(songs, eq(interactions.songId, songs.id))
        .where(where)
        .orderBy(desc(interactions.createdAt))
        .limit(limit)
        .offset(offset),
      this.db.select({ total: count() }).from(interactions).where(where),
    ]);

    const total = totalRows[0]?.total ?? 0;

    return { data, meta: { page, limit, total } };
  }

  async getHistory(
    userId: string,
    page: number,
    limit: number,
  ): Promise<PaginatedResult<SongWithTimestamp>> {
    const offset = (page - 1) * limit;
    const where = and(
      eq(interactions.userId, userId),
      eq(interactions.eventType, 'play'),
    );
    const interactedAt = max(interactions.createdAt).as('interacted_at');

    const [data, totalRows] = await Promise.all([
      this.db
        .select({
          ...songSummaryColumns,
          interactedAt,
        })
        .from(interactions)
        .innerJoin(songs, eq(interactions.songId, songs.id))
        .where(where)
        .groupBy(songs.id)
        .orderBy(desc(interactedAt))
        .limit(limit)
        .offset(offset),
      this.db
        .select({ total: countDistinct(interactions.songId) })
        .from(interactions)
        .where(where),
    ]);

    const total = totalRows[0]?.total ?? 0;

    const normalized: SongWithTimestamp[] = data.map((row) => ({
      ...row,
      interactedAt:
        row.interactedAt instanceof Date
          ? row.interactedAt
          : new Date(row.interactedAt as unknown as string),
    }));

    return { data: normalized, meta: { page, limit, total } };
  }
}
