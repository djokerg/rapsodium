import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import { DATABASE, type Database } from '../database/database.module.js';
import { interactions, songs } from '../database/schema.js';
import {
  isToggleEvent,
  type CreateInteractionDto,
  type EventType,
  type ToggleEventType,
} from './interactions.schemas.js';
import type { Interaction } from './interactions.types.js';

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
}
