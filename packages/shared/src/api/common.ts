// Response shapes of the v2 API (apps/api), written from the route code and apps/api/docs/routes-*.md.
// Types only: the API does not validate its responses against them, so keep them in step when a route changes.
// Many columns come back as PDO strings (see the docs); such fields are typed `string` or `number | string`.

// 0 - dislike, 1 - neutral, 2 - like, 3 - super (movie_vote.vote)
export type VoteValue = 0 | 1 | 2 | 3;
export type VoteName = 'dislike' | 'neutral' | 'like' | 'super';

// Error bodies: `msg` from most routes, `err` from the 404s ported from PHP.
export interface ApiErrorBody {
  success: false;
  msg?: string;
  err?: string;
}

export interface Paged<T> {
  total: number;
  page: number;
  pages: number;
  entities: T[];
}

export interface PagedResponse<T> {
  success: true;
  results: Paged<T>;
}
