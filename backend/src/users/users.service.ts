import {Inject, Injectable, NotFoundException} from '@nestjs/common';
import {eq} from 'drizzle-orm';
import {DATABASE, type Database} from '../database/database.module.js';
import {userPreferences, users} from '../database/schema.js';
import type {UpdatePreferencesDto} from './users.schemas.js';

export interface Preference {
  genre: string;
}

export interface UserProfile {
  id: string;
  email: string;
  createdAt: Date;
  preferences: Preference[];
}

@Injectable()
export class UsersService {
  constructor(@Inject(DATABASE) private readonly db: Database) {}

  async getProfile(userId: string): Promise<UserProfile> {
    const rows = await this.db
      .select({
        id: users.id,
        email: users.email,
        createdAt: users.createdAt,
      })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (rows.length === 0) {
      throw new NotFoundException('User not found');
    }

    const preferences = await this.db
      .select({
        genre: userPreferences.genre,
      })
      .from(userPreferences)
      .where(eq(userPreferences.userId, userId));

    return { ...rows[0], preferences };
  }

  async replacePreferences(
    userId: string,
    preferences: UpdatePreferencesDto,
  ): Promise<Preference[]> {
    return this.db.transaction(async (tx) => {
      const [user] = await tx
        .select({ id: users.id })
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);

      if (!user) {
        throw new NotFoundException('User not found');
      }

      await tx
        .delete(userPreferences)
        .where(eq(userPreferences.userId, userId));

      return tx
          .insert(userPreferences)
          .values(
              preferences.map((genre) => ({
                  userId,
                  genre,
              })),
          )
          .returning({
              genre: userPreferences.genre,
          });
    });
  }
}
