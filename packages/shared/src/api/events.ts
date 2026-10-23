// GET /api/events: server-sent events for signed-in viewers (apps/api/docs/events.md).
import type { VoteCounters } from './movies.js';

// `event: vote`: a movie's counters after someone voted on it (the legacy socket.io `vote-changed`). For the
// viewer's own votes, from any tab or device, the viewer's flags come along; other people's votes never carry them.
export interface VoteChangedEvent extends VoteCounters {
  id: number;
  isSuper?: boolean;
  isLiked?: boolean;
  isNeutral?: boolean;
  isDisliked?: boolean;
}

// Server-sent event names (the `event:` field) and their `data` JSON.
export interface LiveEventMap {
  vote: VoteChangedEvent;
}
