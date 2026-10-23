import { describe, expect, it, vi } from 'vitest';

import { KinopoiskClient, KinopoiskError } from './client.js';
import { bestMatch, titleSimilarity } from './match.js';
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

  it('scores similar titles between 0 and 1', () => {
    expect(titleSimilarity('Ёлки', 'Елки')).toBe(1);
    expect(titleSimilarity('Матрица', 'Матрица: Перезагрузка')).toBeGreaterThan(0.4);
    expect(titleSimilarity('Матрица', 'Аватар')).toBeLessThan(0.3);
  });
});
