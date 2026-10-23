import type { KpFilmListItem } from './types.js';

// Picks the Кинопоиск film that matches a title and year: the same idea as kp-parser's search
// (Dice similarity of title bigrams, year within ±2), used to fill movie.kp_id.

function bigrams(s: string): string[] {
  const clean = s.toLowerCase().replace(/ё/g, 'е').replace(/\s+/g, '');
  const out: string[] = [];
  for (let i = 0; i < clean.length - 1; i++) out.push(clean.slice(i, i + 2));
  return out;
}

export function titleSimilarity(a: string, b: string): number {
  if (a.trim().toLowerCase() === b.trim().toLowerCase()) return 1;
  const x = bigrams(a);
  const y = bigrams(b);
  if (!x.length || !y.length) return 0;
  const counts = new Map<string, number>();
  for (const g of x) counts.set(g, (counts.get(g) ?? 0) + 1);
  let hits = 0;
  for (const g of y) {
    const n = counts.get(g) ?? 0;
    if (n > 0) {
      hits++;
      counts.set(g, n - 1);
    }
  }
  return (2 * hits) / (x.length + y.length);
}

export interface MatchQuery {
  titles: string[];
  year?: number | null;
  kind?: 'movie' | 'tv' | null;
}

export interface Match {
  kinopoiskId: number;
  similarity: number;
}

export function bestMatch(query: MatchQuery, items: KpFilmListItem[], minSimilarity = 0.8): Match | null {
  let best: Match | null = null;
  for (const item of items) {
    if (query.kind === 'tv' && !['TV_SERIES', 'MINI_SERIES', 'TV_SHOW'].includes(item.type)) continue;
    if (query.kind === 'movie' && item.type !== 'FILM') continue;
    if (query.year && item.year && Math.abs(item.year - query.year) > 2) continue;
    const names = [item.nameRu, item.nameOriginal, item.nameEn].filter((n): n is string => !!n);
    let similarity = 0;
    for (const t of query.titles) for (const n of names) similarity = Math.max(similarity, titleSimilarity(t, n));
    if (similarity >= minSimilarity && (!best || similarity > best.similarity)) {
      best = { kinopoiskId: item.kinopoiskId, similarity };
    }
  }
  return best;
}
