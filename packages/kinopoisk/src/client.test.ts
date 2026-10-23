import { describe, expect, it, vi } from 'vitest';

import { KinopoiskClient, KinopoiskError } from './client.js';
import { bestMatch, normalizeTitle, titleNumbers, titleSimilarity } from './match.js';
import type { KpFilmListItem } from './types.js';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

describe('KinopoiskClient', () => {
  it('sends the API key and query', async () => {
    const fetch = vi.fn(async () => json({ total: 0, totalPages: 0, items: [] }));
    const kp = new KinopoiskClient({ apiKey: 'k', fetch });
    await kp.searchFilms({ keyword: 'Шоу Трумана', yearFrom: 1996, yearTo: 2000 });
    const [url, init] = fetch.mock.calls[0] as unknown as [URL, RequestInit];
    expect(url.pathname).toBe('/api/v2.2/films');
    expect(url.searchParams.get('keyword')).toBe('Шоу Трумана');
    expect(url.searchParams.get('yearFrom')).toBe('1996');
    expect((init.headers as Record<string, string>)['X-API-KEY']).toBe('k');
  });

  it('returns null for a missing film and retries after 429', async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(json({}, 429))
      .mockResolvedValueOnce(json({ message: 'not found' }, 404));
    const kp = new KinopoiskClient({ apiKey: 'k', fetch, retries: 2 });
    expect(await kp.getFilm(1)).toBeNull();
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('throws on other errors', async () => {
    const kp = new KinopoiskClient({ apiKey: 'k', fetch: async () => json({}, 401) });
    await expect(kp.getFilters()).rejects.toBeInstanceOf(KinopoiskError);
  });
});

describe('bestMatch', () => {
  const item = (over: Partial<KpFilmListItem>): KpFilmListItem => ({
    kinopoiskId: 1,
    imdbId: null,
    nameRu: null,
    nameEn: null,
    nameOriginal: null,
    countries: [],
    genres: [],
    ratingKinopoisk: null,
    ratingImdb: null,
    year: null,
    type: 'FILM',
    posterUrl: null,
    posterUrlPreview: null,
    ...over,
  });

  it('prefers the closest title within the year window', () => {
    const items = [
      item({ kinopoiskId: 2, nameRu: 'Шоу Трумана', nameOriginal: 'The Truman Show', year: 1998 }),
      item({ kinopoiskId: 3, nameRu: 'Шоу', year: 1998 }),
      item({ kinopoiskId: 4, nameRu: 'Шоу Трумана', year: 2015 }),
    ];
    expect(bestMatch({ titles: ['The Truman Show'], year: 1998 }, items)).toEqual({ kinopoiskId: 2, similarity: 1 });
  });

  it('respects the film/series kind', () => {
    const items = [item({ kinopoiskId: 5, nameRu: 'Друзья', type: 'TV_SERIES' })];
    expect(bestMatch({ titles: ['Друзья'], kind: 'movie' }, items)).toBeNull();
    expect(bestMatch({ titles: ['Друзья'], kind: 'tv' }, items)?.kinopoiskId).toBe(5);
  });

  it('prefers the closest year among equally similar titles', () => {
    const items = [
      item({ kinopoiskId: 10, nameRu: 'Брат', year: 1999 }),
      item({ kinopoiskId: 11, nameRu: 'Брат', year: 1997 }),
      item({ kinopoiskId: 12, nameRu: 'Брат', year: 1998 }),
    ];
    expect(bestMatch({ titles: ['Брат'], year: 1997 }, items)).toEqual({ kinopoiskId: 11, similarity: 1 });
    // without a year the search order decides
    expect(bestMatch({ titles: ['Брат'] }, items)?.kinopoiskId).toBe(10);
  });

  it('does not take a sequel for the film', () => {
    const items = [item({ kinopoiskId: 13, nameRu: 'Матрица 4', year: 2021 })];
    expect(bestMatch({ titles: ['Матрица'], year: 2021 }, items)).toBeNull();
  });

  it('scores similar titles between 0 and 1', () => {
    expect(titleSimilarity('Ёлки', 'Елки')).toBe(1);
    expect(titleSimilarity('Матрица', 'Матрица: Перезагрузка')).toBeGreaterThan(0.4);
    expect(titleSimilarity('Матрица', 'Аватар')).toBeLessThan(0.3);
  });

  it('ignores punctuation, ellipses, quotes and dashes', () => {
    expect(titleSimilarity('Прощай, любимая', 'Прощай, любимая...')).toBe(1);
    expect(titleSimilarity('Прощай, любимая', 'Прощай, любимая…')).toBe(1);
    expect(titleSimilarity('«Ирония судьбы»', '"Ирония судьбы"')).toBe(1);
    expect(titleSimilarity('Spider-Man: No Way Home', 'Spider Man — No Way Home')).toBe(1);
    expect(titleSimilarity("Ocean's Eleven", 'Ocean’s Eleven')).toBe(1);
    expect(normalizeTitle('  Ёжик  в тумане!? ')).toBe('ежик в тумане');
  });

  it('keeps titles with different numbers apart', () => {
    expect(titleSimilarity('Матрица', 'Матрица 4')).toBeLessThan(0.8);
    expect(titleSimilarity('Брат 2', 'Брат 3')).toBeLessThan(0.8);
    expect(titleSimilarity('Rocky II', 'Rocky 2')).toBe(1);
    expect(titleNumbers('Терминатор 2: Судный день 1991')).toBe('2,1991');
    // not a numeral: "constructor" is not looked up on Object.prototype
    expect(normalizeTitle('constructor')).toBe('constructor');
  });
});
