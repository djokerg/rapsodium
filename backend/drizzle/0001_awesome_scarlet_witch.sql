ALTER TABLE "songs" ALTER COLUMN "deezer_id" SET DATA TYPE bigint;--> statement-breakpoint
CREATE UNIQUE INDEX "interactions_toggle_unique_idx" ON "interactions" USING btree ("user_id","song_id","event_type") WHERE event_type in ('like', 'save', 'dislike');--> statement-breakpoint
CREATE UNIQUE INDEX "user_preferences_user_genre_idx" ON "user_preferences" USING btree ("user_id","genre");