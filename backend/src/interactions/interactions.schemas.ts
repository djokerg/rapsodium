import { z } from 'zod';

export const EVENT_TYPES = ['play', 'skip', 'like', 'dislike', 'save'] as const;
export type EventType = (typeof EVENT_TYPES)[number];

export const TOGGLE_EVENT_TYPES = ['like', 'dislike', 'save'] as const;
export type ToggleEventType = (typeof TOGGLE_EVENT_TYPES)[number];

export function isToggleEvent(eventType: EventType): eventType is ToggleEventType {
  return (TOGGLE_EVENT_TYPES as readonly EventType[]).includes(eventType);
}

export const createInteractionSchema = z.object({
  songId: z.string().uuid('Invalid song ID'),
  eventType: z.enum(EVENT_TYPES),
  listenedSeconds: z.number().int().nonnegative().optional(),
});

export type CreateInteractionDto = z.infer<typeof createInteractionSchema>;

export const deleteInteractionSchema = z.object({
  songId: z.string().uuid('Invalid song ID'),
  eventType: z.enum(TOGGLE_EVENT_TYPES),
});

export type DeleteInteractionDto = z.infer<typeof deleteInteractionSchema>;
