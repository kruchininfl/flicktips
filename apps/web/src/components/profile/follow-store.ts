'use client';

// The follow state changed on this page, so every copy of a user (profile, friends list, search results,
// recommendations) shows the same button. The legacy reducers applied USER_SUBSCRIBE_FINISH to all of them.
import { useSyncExternalStore } from 'react';

const overrides = new Map<number, boolean>();
const listeners = new Set<() => void>();

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function setFollowing(userId: number, subscribed: boolean): void {
  overrides.set(userId, subscribed);
  for (const listener of listeners) listener();
}

export function useFollowing(userId: number, initial: boolean): boolean {
  const override = useSyncExternalStore(
    subscribe,
    () => overrides.get(userId),
    () => undefined,
  );
  return override ?? initial;
}
