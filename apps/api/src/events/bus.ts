// Pub/sub between the routes that change data and the open GET /api/events streams (docs/events.md).
//
// One API instance today, so the default bus is in-process. Everything that crosses it is plain JSON, so a
// Redis implementation (PUBLISH on publish(), one SUBSCRIBE connection feeding the local listeners) can replace
// MemoryEventBus without touching the routes.
import type { VoteCounters } from '@flicktips/shared';

// A vote was set, changed or removed. `userId` is the voter: only their own streams get `flags`.
export interface VoteLiveEvent {
  type: 'vote';
  userId: number;
  movie: VoteCounters & { id: number };
  flags: { isSuper: boolean; isLiked: boolean; isNeutral: boolean; isDisliked: boolean };
}

export type LiveEvent = VoteLiveEvent;

export type LiveEventListener = (event: LiveEvent) => void;

export interface EventBus {
  // Fire and forget: delivery is best effort, a failing listener never fails the publisher.
  publish(event: LiveEvent): void;
  // Returns the unsubscribe function.
  subscribe(listener: LiveEventListener): () => void;
}

export class MemoryEventBus implements EventBus {
  private readonly listeners = new Set<LiveEventListener>();

  constructor(private readonly onError: (error: unknown) => void = () => {}) {}

  publish(event: LiveEvent): void {
    for (const listener of [...this.listeners]) {
      try {
        listener(event);
      } catch (error) {
        this.onError(error);
      }
    }
  }

  subscribe(listener: LiveEventListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  get listenerCount(): number {
    return this.listeners.size;
  }
}
