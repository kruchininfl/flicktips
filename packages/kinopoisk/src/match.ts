import type { KpFilmListItem } from './types.js';

// Picks the Кинопоиск film that matches a title and year: the same idea as kp-parser's search
// (Dice similarity of title bigrams, year within ±2), used to fill movie.kp_id.

const ROMAN = new Map(
  ['ii', 'iii', 'iv', 'v', 'vi', 'vii', 'viii', 'ix', 'x', 'xi', 'xii', 'xiii'].map((r, i) => [r, String(i + 2)]),
);

// Lower case, ё → е, Roman numerals II–XIII → digits, apostrophes dropped, every other punctuation mark or symbol
// (ellipses, quotes «»“”, dashes –—, colons…) → a space, spaces collapsed. "Прощай, любимая..." and
// "Прощай, любимая" become the same string.
export function normalizeTitle(s: string): string {
  return s
    .normalize('NFKC')
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/['’‘`ʼ]/g, '')
    .replace(/[\p{P}\p{S}]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .map((w) => ROMAN.get(w) ?? w)
    .join(' ');
}

// The numbers in a title, sorted: "Матрица 4" → "4", "Брат 2" → "2", "Rocky II" → "2"
export function titleNumbers(s: string): string {
  return (normalizeTitle(s).match(/\d+/g) ?? [])
    .map(Number)
    .sort((a, b) => a - b)
    .join(',');
}

// Titles whose numbers differ are a sequel, a part or a remake year, not a spelling variant: their similarity is
// multiplied by this, which keeps them below bestMatch's default floor of 0.8.
export const NUMBER_MISMATCH_FACTOR = 0.7;

function bigrams(normalized: string): string[] {
  const clean = normalized.replace(/\s+/g, '');
  const out: string[] = [];
  for (let i = 0; i < clean.length - 1; i++) out.push(clean.slice(i, i + 2));
  return out;
}

function dice(a: string, b: string): number {
  if (a === b) return a ? 1 : 0;
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

// 0..1: Dice similarity of the bigrams of the normalised titles; 1 for titles equal after normalisation.
export function titleSimilarity(a: string, b: string): number {
  const x = normalizeTitle(a);
  const y = normalizeTitle(b);
  const similarity = dice(x, y);
  return titleNumbers(x) === titleNumbers(y) ? similarity : similarity * NUMBER_MISMATCH_FACTOR;
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

const yearDistance = (query: MatchQuery, item: KpFilmListItem) =>
  query.year && item.year ? Math.abs(item.year - query.year) : 3;

// The most similar title of the right kind within ±2 years; among equally similar ones, the closest in year
// (a film and its remake of the same name), then the first (the search order).
export function bestMatch(query: MatchQuery, items: KpFilmListItem[], minSimilarity = 0.8): Match | null {
  let best: { match: Match; years: number } | null = null;
  for (const item of items) {
    if (query.kind === 'tv' && !['TV_SERIES', 'MINI_SERIES', 'TV_SHOW'].includes(item.type)) continue;
    if (query.kind === 'movie' && item.type !== 'FILM') continue;
    if (query.year && item.year && Math.abs(item.year - query.year) > 2) continue;
    const names = [item.nameRu, item.nameOriginal, item.nameEn].filter((n): n is string => !!n);
    let similarity = 0;
    for (const t of query.titles) for (const n of names) similarity = Math.max(similarity, titleSimilarity(t, n));
    if (similarity < minSimilarity) continue;
    const years = yearDistance(query, item);
    const better =
      !best ||
      similarity > best.match.similarity + 1e-9 ||
      (Math.abs(similarity - best.match.similarity) <= 1e-9 && years < best.years);
    if (better) best = { match: { kinopoiskId: item.kinopoiskId, similarity }, years };
  }
  return best?.match ?? null;
}
