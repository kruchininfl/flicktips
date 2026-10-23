import { describe, expect, it } from 'vitest';

import type { DuplicateGroup, DuplicateMovie } from './db.js';
import { kpRefFromDb, planGroup, scoreMovie, type KpRef } from './dedupe-score.js';

const movie = (id: number, over: Partial<DuplicateMovie>): DuplicateMovie => ({
  kpId: 1,
  id,
  tmdbId: String(id),
  type: 'movie',
  title: null,
  originalTitle: null,
  year: null,
  kpTitle: null,
  kpOriginalTitle: null,
  kpYear: null,
  suspend: 0,
  votes: 0,
  bookmarks: 0,
  tgPosts: 0,
  counters: 0,
  ...over,
});

const group = (kpId: number, movies: DuplicateMovie[]): DuplicateGroup => ({
  kpId,
  movies: movies.map((m) => ({ ...m, kpId })),
  sharedVoters: 0,
  sharedBookmarkers: 0,
});

const ref = (over: Partial<KpRef>): KpRef => ({
  title: null,
  originalTitle: null,
  year: null,
  type: null,
  source: 'db',
  ...over,
});

describe('suggest_keep scoring', () => {
  // kp 316 in production: kp-parser gave "The Rev" the kp_id of The Matrix Revolutions
  const rev = movie(19475, {
    title: 'Преподобный',
    originalTitle: 'The Rev',
    year: 2002,
    kpTitle: 'Матрица: Революция',
  });
  const matrix = movie(57250, {
    title: 'Матрица: Революция',
    originalTitle: 'The Matrix Revolutions',
    year: 2003,
    kpTitle: 'Матрица: Революция',
  });

  it('keeps the movie whose title matches the Кинопоиск title, not the oldest one', () => {
    const g = group(316, [rev, matrix]);
    const p = planGroup(g, kpRefFromDb(g.movies), 'flicktips');
    expect(p).toMatchObject({ keepId: 57250, clearIds: [19475], status: 'auto_safe', reasons: [] });
    expect(p.movies.find((m) => m.id === 19475)).toMatchObject({ action: 'clear' });
    expect(p.movies.find((m) => m.id === 57250)).toMatchObject({ action: 'keep', titleSimilarity: 1 });
  });

  it('a title match beats votes, but votes on the cleared movie need a review', () => {
    const g = group(316, [{ ...rev, votes: 3 }, matrix]);
    const p = planGroup(g, kpRefFromDb(g.movies), 'flicktips');
    expect(p.keepId).toBe(57250);
    expect(p.status).toBe('needs_review');
    expect(p.reasons.join()).toContain('votes/bookmarks on movies that would lose the kp_id: 19475 (3 votes');
  });

  it('Брат (1997) keeps the kp_id over a Брат without a year', () => {
    const kp = ref({ title: 'Брат', year: 1997 });
    const brat = movie(10, { title: 'Брат', originalTitle: 'Brother', year: 1997 });
    const noYear = movie(5, { title: 'Брат', originalTitle: 'Brat' });
    expect(scoreMovie(brat, kp).score).toBeGreaterThan(scoreMovie(noYear, kp).score);
    const p = planGroup(group(41519, [noYear, brat]), kp, 'flicktips');
    expect(p).toMatchObject({ keepId: 10, clearIds: [5], status: 'auto_safe' });
    expect(p.movies.find((m) => m.id === 5)?.note).toContain('movie has no year');
  });

  it('two Брат without a year are a tie: usage picks the keep, and a human reviews it', () => {
    const kp = ref({ title: 'Брат' });
    const a = movie(5, { title: 'Брат' });
    const b = movie(10, { title: 'Брат', bookmarks: 1 });
    const p = planGroup(group(41519, [a, b]), kp, 'flicktips');
    expect(p.keepId).toBe(10);
    expect(p.status).toBe('needs_review');
    expect(p.reasons.join()).toContain('no clear winner');
  });

  it('a year far off counts against the movie', () => {
    const kp = ref({ title: 'Брат', year: 1997 });
    const remake = movie(3, { title: 'Брат', year: 2015 });
    const original = movie(4, { title: 'Брат', year: 1998 });
    expect(planGroup(group(1, [remake, original]), kp, 'x')).toMatchObject({ keepId: 4, status: 'auto_safe' });
  });

  it('needs review when no movie matches the Кинопоиск film well', () => {
    const kp = ref({ title: 'Матрица: Революция', year: 2003 });
    const p = planGroup(group(316, [rev, movie(2, { title: 'Матрица', year: 1999 })]), kp, 'x');
    expect(p.status).toBe('needs_review');
    expect(p.reasons[0]).toMatch(/^no movie matches "Матрица: Революция" well/);
  });

  it('a sequel does not count as the film', () => {
    const kp = ref({ title: 'Матрица', year: 1999 });
    const sequel = movie(1, { title: 'Матрица 4', year: 1999 });
    expect(scoreMovie(sequel, kp).titleSimilarity).toBeLessThan(0.8);
  });

  it('uses the kind when the film was fetched', () => {
    const kp = ref({ title: 'Чернобыль', year: 2019, type: 'MINI_SERIES', source: 'api' });
    const series = movie(1, { type: 'tv', title: 'Чернобыль', year: 2019 });
    const film = movie(2, { type: 'movie', title: 'Чернобыль', year: 2019, votes: 5 });
    expect(scoreMovie(series, kp).kindMatch).toBe(true);
    expect(scoreMovie(film, kp).kindMatch).toBe(false);
    const p = planGroup(group(1, [series, film]), kp, 'x');
    expect(p.keepId).toBe(1);
    expect(p.status).toBe('needs_review'); // the film has votes
  });

  it('needs review without a Кинопоиск title', () => {
    const g = group(7, [movie(1, { title: 'A', votes: 1 }), movie(2, { title: 'B' })]);
    const p = planGroup(g, kpRefFromDb(g.movies), 'x');
    expect(p.kp.source).toBe('none');
    expect(p).toMatchObject({ keepId: 1, status: 'needs_review' });
    expect(p.reasons[0]).toContain('--fetch-kp');
  });

  it('takes the most common kp_title of the group', () => {
    const ms = [
      movie(1, { kpTitle: 'Old name' }),
      movie(2, { kpTitle: 'Брат', kpYear: 1997 }),
      movie(3, { kpTitle: 'Брат' }),
    ];
    expect(kpRefFromDb(ms)).toEqual({ title: 'Брат', originalTitle: null, year: 1997, type: null, source: 'db' });
  });
});
