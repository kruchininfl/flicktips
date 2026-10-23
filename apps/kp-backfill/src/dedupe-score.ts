// Which movie of a group sharing a kp_id is the Кинопоиск film. In production these groups are mostly wrong
// kp_ids that kp-parser gave to making-ofs, namesakes and films of another year, not the same film imported
// twice (no two movies of a group share a tmdb_id), so the movie whose title and year match the Кинопоиск film
// keeps the kp_id; votes and bookmarks only break ties.
import { titleSimilarity, type KpFilmType } from '@flicktips/kinopoisk';

import { cleanTitle, TV_TYPES } from './classify.js';
import type { DuplicateGroup, DuplicateMovie } from './db.js';

// The Кинопоиск film the group's kp_id points to
export interface KpRef {
  title: string | null;
  originalTitle: string | null;
  year: number | null;
  // only known when fetched (--fetch-kp); the database does not keep it
  type: KpFilmType | null;
  // db: the kp_title / kp_original_title / kp_start_year columns of the group; api: fetched; none: neither
  source: 'db' | 'api' | 'none';
}

export interface MovieScore {
  titleSimilarity: number;
  yearDiff: number | null;
  // null: the movie type or the Кинопоиск type is unknown
  kindMatch: boolean | null;
  score: number;
}

export type GroupStatus = 'auto_safe' | 'needs_review';

export interface PlanMovie {
  id: number;
  tmdbId: string | null;
  type: string | null;
  year: number | null;
  title: string | null;
  originalTitle: string | null;
  suspend: number;
  votes: number;
  bookmarks: number;
  tgPosts: number;
  titleSimilarity: number;
  yearDiff: number | null;
  kindMatch: boolean | null;
  score: number;
  action: 'keep' | 'clear';
  note: string;
}

// One line of dedupe-plan.jsonl
export interface PlanRow {
  database: string;
  kpId: number;
  kp: KpRef;
  status: GroupStatus;
  // a human sets this to true to have dedupe-apply apply a needs_review row (after checking keepId)
  approve: boolean;
  keepId: number;
  // every other movie of the group: their kp_id is cleared
  clearIds: number[];
  reasons: string[];
  movies: PlanMovie[];
}

export const SCORE = {
  // the keep must match the Кинопоиск title at least this well…
  goodTitle: 0.9,
  // …and score this much more than every other movie of the group
  clearMargin: 0.1,
  yearSame: 0.3,
  yearOffByOne: 0.15,
  yearFarOff: -0.3,
  kindMatch: 0.1,
  kindMismatch: -0.2,
};

const usage = (m: DuplicateMovie) => m.votes + m.bookmarks;

function mostCommon<T>(values: (T | null)[]): T | null {
  const counts = new Map<T, number>();
  for (const v of values) if (v !== null && v !== '') counts.set(v, (counts.get(v) ?? 0) + 1);
  let best: T | null = null;
  let n = 0;
  for (const [v, c] of counts) if (c > n) [best, n] = [v, c];
  return best;
}

// What kp-parser stored about the film; every movie of the group normally carries the same values
export function kpRefFromDb(movies: DuplicateMovie[]): KpRef {
  const title = mostCommon(movies.map((m) => m.kpTitle));
  const originalTitle = mostCommon(movies.map((m) => m.kpOriginalTitle));
  const year = mostCommon(movies.map((m) => m.kpYear));
  return { title, originalTitle, year, type: null, source: title || originalTitle ? 'db' : 'none' };
}

function kindMatches(movieType: string | null, kpType: KpFilmType | null): boolean | null {
  if (!kpType || (movieType !== 'movie' && movieType !== 'tv')) return null;
  // VIDEO: making-ofs and direct-to-video films, which TMDb has as movies
  return movieType === 'tv' ? TV_TYPES.includes(kpType) : kpType === 'FILM' || kpType === 'VIDEO';
}

export function scoreMovie(m: DuplicateMovie, kp: KpRef): MovieScore {
  const titles = [cleanTitle(m.title), cleanTitle(m.originalTitle)].filter((t): t is string => !!t);
  const names = [kp.title, kp.originalTitle].filter((t): t is string => !!t);
  let similarity = 0;
  for (const t of titles) for (const n of names) similarity = Math.max(similarity, titleSimilarity(t, n));
  similarity = Math.round(similarity * 1000) / 1000;
  const yearDiff = m.year !== null && kp.year !== null ? Math.abs(m.year - kp.year) : null;
  const kindMatch = kindMatches(m.type, kp.type);
  let score = similarity;
  if (yearDiff === 0) score += SCORE.yearSame;
  else if (yearDiff === 1) score += SCORE.yearOffByOne;
  else if (yearDiff !== null && yearDiff > 2) score += SCORE.yearFarOff;
  if (kindMatch === true) score += SCORE.kindMatch;
  if (kindMatch === false) score += SCORE.kindMismatch;
  return { titleSimilarity: similarity, yearDiff, kindMatch, score: Math.round(score * 1000) / 1000 };
}

const describe = (m: DuplicateMovie, s: MovieScore, kp: KpRef) => {
  const parts = [`title ${s.titleSimilarity}`];
  if (s.yearDiff !== null) parts.push(`year ${m.year} vs ${kp.year}`);
  else parts.push(m.year === null ? 'movie has no year' : 'Кинопоиск year unknown');
  if (s.kindMatch === false) parts.push(`kind ${m.type} vs ${kp.type}`);
  if (usage(m)) parts.push(`${m.votes} votes, ${m.bookmarks} bookmarks`);
  return parts.join(', ');
};

export function planGroup(group: DuplicateGroup, kp: KpRef, database: string): PlanRow {
  const scored = group.movies.map((m) => ({ m, s: scoreMovie(m, kp) }));
  // score, then usage, then not suspended, has a TMDb id, oldest
  scored.sort(
    (a, b) =>
      b.s.score - a.s.score ||
      usage(b.m) - usage(a.m) ||
      a.m.suspend - b.m.suspend ||
      Number(!!b.m.tmdbId) - Number(!!a.m.tmdbId) ||
      a.m.id - b.m.id,
  );
  const [keep, runnerUp] = scored as [(typeof scored)[number], ...(typeof scored)[number][]];
  const reasons: string[] = [];
  const names = [kp.title, kp.originalTitle].filter(Boolean).join(' / ');

  if (kp.source === 'none') reasons.push('no Кинопоиск title to compare with (run with --fetch-kp)');
  else {
    const weak: string[] = [];
    if (keep.s.titleSimilarity < SCORE.goodTitle) weak.push(`title similarity ${keep.s.titleSimilarity}`);
    if (keep.s.yearDiff !== null && keep.s.yearDiff > 1) weak.push(`year ${keep.m.year} vs ${kp.year}`);
    if (keep.s.kindMatch === false) weak.push(`kind ${keep.m.type} vs ${kp.type}`);
    if (weak.length) reasons.push(`no movie matches "${names}" well: best ${keep.m.id} has ${weak.join(', ')}`);
    if (runnerUp && keep.s.score - runnerUp.s.score < SCORE.clearMargin) {
      reasons.push(`no clear winner: ${runnerUp.m.id} scores ${runnerUp.s.score} vs ${keep.s.score}`);
    }
  }
  const usedCleared = scored.slice(1).filter(({ m }) => usage(m) > 0);
  if (usedCleared.length) {
    reasons.push(
      `votes/bookmarks on movies that would lose the kp_id: ` +
        usedCleared.map(({ m }) => `${m.id} (${m.votes} votes, ${m.bookmarks} bookmarks)`).join(', '),
    );
  }

  return {
    database,
    kpId: group.kpId,
    kp,
    status: reasons.length ? 'needs_review' : 'auto_safe',
    approve: false,
    keepId: keep.m.id,
    clearIds: scored
      .slice(1)
      .map(({ m }) => m.id)
      .sort((a, b) => a - b),
    reasons,
    movies: group.movies.map((m) => {
      const s = scored.find((x) => x.m === m)?.s as MovieScore;
      return {
        id: m.id,
        tmdbId: m.tmdbId,
        type: m.type,
        year: m.year,
        title: m.title,
        originalTitle: m.originalTitle,
        suspend: m.suspend,
        votes: m.votes,
        bookmarks: m.bookmarks,
        tgPosts: m.tgPosts,
        ...s,
        action: m === keep.m ? 'keep' : 'clear',
        note: describe(m, s, kp),
      };
    }),
  };
}
