// Decides whether a Кинопоиск search result is the movie: `bestMatch` from @flicktips/kinopoisk picks the
// candidate, the rules below decide whether it is safe to write without a human looking at it.
import { bestMatch, titleSimilarity, type KpFilmListItem } from '@flicktips/kinopoisk';

export interface MovieRow {
  id: number;
  tmdbId: string | null;
  imdbId: string | null;
  type: string | null;
  title: string | null;
  originalTitle: string | null;
  releaseDate: string | null;
  firstAirDate: string | null;
  kpError: string | null;
}

export interface MovieQuery {
  titles: string[];
  year: number | null;
  kind: 'movie' | 'tv' | null;
  imdbId: string | null;
}

export type MatchStatus = 'confident' | 'ambiguous' | 'not_found';

export interface Candidate {
  kinopoiskId: number;
  name: string;
  year: number | null;
  type: string;
  similarity: number;
  // the movie title that matched `name` best
  matchedTitle: string;
  yearDiff: number | null;
  // passes the kind and ±2 year filters of bestMatch
  eligible: boolean;
}

export interface Classification {
  status: MatchStatus;
  kpId: number | null;
  similarity: number | null;
  yearDiff: number | null;
  best: Candidate | null;
  // the best few candidates, most similar first
  candidates: Candidate[];
  reasons: string[];
}

export interface Thresholds {
  // floor passed to bestMatch: below it a result is not a candidate at all
  minSimilarity: number;
  // confident needs at least this similarity and the same year…
  confidentSimilarity: number;
  // …or at least this one and a year that differs by at most 1 (TMDb and Кинопоиск often disagree by a year)
  exactSimilarity: number;
  // another eligible candidate this close to the best one makes the match ambiguous
  runnerUpMargin: number;
}

export const DEFAULT_THRESHOLDS: Thresholds = {
  minSimilarity: 0.8,
  confidentSimilarity: 0.9,
  exactSimilarity: 0.97,
  runnerUpMargin: 0.05,
};

export const TV_TYPES = ['TV_SERIES', 'MINI_SERIES', 'TV_SHOW'];

export function cleanTitle(title: string | null): string | null {
  // TMDb-era titles sometimes carry the kp-parser hint " (сериал)", which Кинопоиск search does not match
  const t = title?.replace(/\s*\(сериал\)\s*$/i, '').trim();
  return t ? t : null;
}

export function yearOf(date: string | null): number | null {
  const m = /^(\d{4})/.exec(date ?? '');
  const year = m ? Number(m[1]) : NaN;
  return year >= 1870 && year <= 2100 ? year : null;
}

// A series is dated by its first air date, a film by its release date; either falls back to the other.
export function movieYear(type: string | null, releaseDate: string | null, firstAirDate: string | null): number | null {
  return type === 'tv' ? (yearOf(firstAirDate) ?? yearOf(releaseDate)) : (yearOf(releaseDate) ?? yearOf(firstAirDate));
}

// The search query for a movie row: original title first (as kp-parser did), then the Russian title.
export function movieQuery(m: MovieRow): MovieQuery {
  const kind = m.type === 'tv' ? 'tv' : m.type === 'movie' ? 'movie' : null;
  const titles: string[] = [];
  for (const t of [cleanTitle(m.originalTitle), cleanTitle(m.title)]) {
    if (t && !titles.some((x) => x.toLowerCase() === t.toLowerCase())) titles.push(t);
  }
  return { titles, year: movieYear(m.type, m.releaseDate, m.firstAirDate), kind, imdbId: m.imdbId?.trim() || null };
}

function kindOk(kind: MovieQuery['kind'], type: string): boolean {
  if (kind === 'tv') return TV_TYPES.includes(type);
  if (kind === 'movie') return type === 'FILM';
  return true;
}

function scoreCandidate(query: MovieQuery, item: KpFilmListItem): Candidate {
  const names = [item.nameRu, item.nameOriginal, item.nameEn].filter((n): n is string => !!n);
  let similarity = 0;
  let name = names[0] ?? '';
  let matchedTitle = query.titles[0] ?? '';
  for (const t of query.titles) {
    for (const n of names) {
      const s = titleSimilarity(t, n);
      if (s > similarity) {
        similarity = s;
        name = n;
        matchedTitle = t;
      }
    }
  }
  const yearDiff = query.year && item.year ? Math.abs(item.year - query.year) : null;
  return {
    kinopoiskId: item.kinopoiskId,
    name,
    year: item.year,
    type: item.type,
    similarity: Math.round(similarity * 1000) / 1000,
    matchedTitle,
    yearDiff,
    eligible: kindOk(query.kind, item.type) && (yearDiff === null || yearDiff <= 2),
  };
}

// The movie and the Кинопоиск title are the same and so is the year, but one is a film and the other a series
// (TMDb and Кинопоиск disagree about mini-series and TV films). Never confident: a human decides.
function isKindMismatch(kind: MovieQuery['kind'], c: Candidate): boolean {
  if (c.similarity < 1 || c.yearDiff !== 0) return false;
  if (kind === 'movie') return c.type === 'MINI_SERIES' || c.type === 'TV_SERIES';
  if (kind === 'tv') return c.type === 'FILM';
  return false;
}

export const KIND_MISMATCH = 'kind_mismatch';

const fmt = (c: Candidate) => `${c.kinopoiskId} "${c.name}" (${c.year ?? '?'}, ${c.type})`;

export function classify(
  query: MovieQuery,
  rawItems: KpFilmListItem[],
  thresholds: Thresholds = DEFAULT_THRESHOLDS,
): Classification {
  const seen = new Set<number>();
  const items = rawItems.filter((i) => !seen.has(i.kinopoiskId) && seen.add(i.kinopoiskId));
  const scored = items.map((i) => scoreCandidate(query, i)).sort((a, b) => b.similarity - a.similarity);
  const candidates = scored.slice(0, 5);
  const result = (status: MatchStatus, best: Candidate | null, reasons: string[]): Classification => ({
    status,
    kpId: best?.kinopoiskId ?? null,
    similarity: best?.similarity ?? null,
    yearDiff: best?.yearDiff ?? null,
    best,
    candidates,
    reasons,
  });

  if (!query.titles.length) return result('not_found', null, ['movie has no title']);
  if (!items.length) return result('not_found', null, ['no search results']);

  // The two legacy rows with an IMDb id: an equal imdbId on Кинопоиск settles it.
  if (query.imdbId) {
    const byImdb = items.find((i) => i.imdbId?.toLowerCase() === query.imdbId?.toLowerCase());
    const c = byImdb && scored.find((s) => s.kinopoiskId === byImdb.kinopoiskId);
    if (c) return result('confident', c, [`imdb_id ${query.imdbId} matches ${fmt(c)}`]);
  }

  const match = bestMatch(query, items, thresholds.minSimilarity);
  const kindMismatch = scored.find((c) => isKindMismatch(query.kind, c));
  if (kindMismatch && !candidates.includes(kindMismatch)) candidates.push(kindMismatch);
  if (!match && kindMismatch) {
    return result('ambiguous', kindMismatch, [
      KIND_MISMATCH,
      `same title and year but ${fmt(kindMismatch)} is not a ${query.kind === 'tv' ? 'series' : 'film'} ` +
        `(movie type ${query.kind})`,
    ]);
  }
  if (!match) {
    const reasons = [`${items.length} results, none with title similarity >= ${thresholds.minSimilarity}`];
    const top = scored[0];
    if (top) reasons.push(`closest: ${fmt(top)} similarity ${top.similarity}`);
    const wrongKind = scored.filter((c) => !kindOk(query.kind, c.type) && c.similarity >= thresholds.minSimilarity);
    if (wrongKind.length) reasons.push(`${wrongKind.length} similar titles of another kind (movie type ${query.kind})`);
    const wrongYear = scored.filter(
      (c) => c.yearDiff !== null && c.yearDiff > 2 && c.similarity >= thresholds.minSimilarity,
    );
    if (wrongYear.length) reasons.push(`${wrongYear.length} similar titles more than 2 years off`);
    return result('not_found', null, reasons);
  }

  // bestMatch prefers the closest year among equally similar candidates
  const best = scored.find((c) => c.kinopoiskId === match.kinopoiskId) as Candidate;
  const reasons = [`best: ${fmt(best)} similarity ${best.similarity}`];
  const blockers: string[] = [];

  if (query.kind === null) blockers.push('movie type is unknown, kind not checked');
  if (query.year === null) blockers.push('movie has no year');
  else if (best.year === null) blockers.push('Кинопоиск has no year');
  else if (best.yearDiff === 0) reasons.push(`year ${best.year} matches`);
  else reasons.push(`year ${best.year} vs ${query.year}`);

  if (best.yearDiff !== null) {
    if (best.yearDiff > 1) blockers.push(`year differs by ${best.yearDiff}`);
    else if (best.yearDiff === 1 && best.similarity < thresholds.exactSimilarity) {
      blockers.push(`year differs by 1 and similarity ${best.similarity} < ${thresholds.exactSimilarity}`);
    }
  }
  if (best.similarity < thresholds.confidentSimilarity) {
    blockers.push(`similarity ${best.similarity} < ${thresholds.confidentSimilarity}`);
  }

  // A rival is as similar and at least as close in year (or the years are unknown): e.g. two films of the same
  // name in one year, or a film and its remake when the movie has no year.
  const rivals = scored.filter(
    (c) =>
      c !== best &&
      c.eligible &&
      c.similarity >= best.similarity - thresholds.runnerUpMargin &&
      (c.yearDiff === null || best.yearDiff === null || c.yearDiff <= best.yearDiff),
  );
  if (rivals.length)
    blockers.push(`${rivals.length} other close candidate(s): ${rivals.slice(0, 3).map(fmt).join('; ')}`);
  // an exact title of the other kind in the same year, while the picked one of the right kind is not confident
  if (blockers.length && kindMismatch)
    blockers.push(`${KIND_MISMATCH}: also ${fmt(kindMismatch)}, same title and year`);

  return result(blockers.length ? 'ambiguous' : 'confident', best, [...reasons, ...blockers]);
}
