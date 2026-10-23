import type { KpFilmListItem } from '@flicktips/kinopoisk';
import { describe, expect, it } from 'vitest';

import { classify, movieQuery, type MovieRow } from './classify.js';

const kpItem = (over: Partial<KpFilmListItem>): KpFilmListItem => ({
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

const row = (over: Partial<MovieRow>): MovieRow => ({
  id: 1,
  tmdbId: '1',
  imdbId: null,
  type: 'movie',
  title: null,
  originalTitle: null,
  releaseDate: null,
  firstAirDate: null,
  kpError: null,
  ...over,
});

const truman = kpItem({ kinopoiskId: 252, nameRu: 'Шоу Трумана', nameOriginal: 'The Truman Show', year: 1998 });

describe('movieQuery', () => {
  it('takes the original title first, the year by kind and drops the (сериал) hint', () => {
    expect(
      movieQuery(row({ type: 'tv', title: 'Друзья (сериал)', originalTitle: 'Friends', firstAirDate: '1994-09-22' })),
    ).toEqual({ titles: ['Friends', 'Друзья'], year: 1994, kind: 'tv', imdbId: null });
    expect(movieQuery(row({ title: 'Up', originalTitle: 'up', releaseDate: '0000-00-00' }))).toEqual({
      titles: ['up'],
      year: null,
      kind: 'movie',
      imdbId: null,
    });
    expect(movieQuery(row({ type: null, title: 'X' })).kind).toBeNull();
  });
});

describe('classify', () => {
  const q = { titles: ['The Truman Show', 'Шоу Трумана'], year: 1998, kind: 'movie' as const, imdbId: null };

  it('is confident for the same title and year', () => {
    const c = classify(q, [truman, kpItem({ kinopoiskId: 3, nameRu: 'Шоу', year: 1998 })]);
    expect(c.status).toBe('confident');
    expect(c.kpId).toBe(252);
    expect(c.similarity).toBe(1);
    expect(c.reasons.join('\n')).toContain('year 1998 matches');
  });

  it('accepts a year off by one only for an (almost) exact title', () => {
    expect(classify({ ...q, year: 1999 }, [truman]).status).toBe('confident');
    const near = kpItem({ kinopoiskId: 9, nameRu: 'Шоу Трумана и', year: 1997 });
    const c = classify({ ...q, titles: ['Шоу Трумана'] }, [near]);
    expect(c.similarity).toBeGreaterThanOrEqual(0.8);
    expect(c.similarity).toBeLessThan(0.97);
    expect(c.status).toBe('ambiguous');
    expect(c.reasons.join('\n')).toMatch(/year differs by 1/);
  });

  it('is ambiguous when the year differs by 2', () => {
    const c = classify({ ...q, year: 2000 }, [truman]);
    expect(c.status).toBe('ambiguous');
    expect(c.reasons.join('\n')).toContain('year differs by 2');
  });

  it('is ambiguous without a year on either side', () => {
    expect(classify({ ...q, year: null }, [truman]).reasons).toContain('movie has no year');
    expect(classify(q, [{ ...truman, year: null }]).status).toBe('ambiguous');
  });

  it('is ambiguous below the confident similarity', () => {
    const c = classify({ ...q, titles: ['Звёздные войны'] }, [
      kpItem({ kinopoiskId: 5, nameRu: 'Звездные воины', year: 1998 }),
    ]);
    expect(c.similarity).toBeGreaterThanOrEqual(0.8);
    expect(c.status).toBe('ambiguous');
    expect(c.reasons.join('\n')).toMatch(/similarity .* < 0.9/);
  });

  it('does not take a sequel for the film (titles that differ by a number)', () => {
    const c = classify({ ...q, titles: ['Матрица'] }, [kpItem({ kinopoiskId: 5, nameRu: 'Матрица 4', year: 1998 })]);
    expect(c.status).toBe('not_found');
    expect(c.candidates[0]?.similarity).toBeLessThan(0.8);
  });

  it('ignores punctuation and ellipses in titles', () => {
    const c = classify({ ...q, titles: ['Прощай, любимая'] }, [
      kpItem({ kinopoiskId: 11, nameRu: 'Прощай, любимая...', year: 1998 }),
    ]);
    expect(c).toMatchObject({ status: 'confident', kpId: 11, similarity: 1 });
  });

  it('prefers the namesake closest in year', () => {
    const brat = (kinopoiskId: number, year: number) => kpItem({ kinopoiskId, nameRu: 'Брат', year });
    const c = classify({ ...q, titles: ['Брат'], year: 1997 }, [brat(1, 1998), brat(41520, 1997), brat(3, 1999)]);
    expect(c.kpId).toBe(41520);
  });

  describe('kind_mismatch', () => {
    const mini = kpItem({
      kinopoiskId: 60,
      nameRu: 'Чернобыль',
      nameOriginal: 'Chernobyl',
      year: 2019,
      type: 'MINI_SERIES',
    });
    const movieQ = { titles: ['Chernobyl', 'Чернобыль'], year: 2019, kind: 'movie' as const, imdbId: null };

    it('a film that Кинопоиск has as a mini-series of the same title and year is ambiguous, not confident', () => {
      const c = classify(movieQ, [mini]);
      expect(c).toMatchObject({ status: 'ambiguous', kpId: 60, reasons: ['kind_mismatch', expect.any(String)] });
      expect(c.candidates.map((x) => x.kinopoiskId)).toContain(60);
      expect(classify(movieQ, [{ ...mini, type: 'TV_SERIES' }]).reasons[0]).toBe('kind_mismatch');
    });

    it('a series that Кинопоиск has as a film', () => {
      const film = { ...mini, type: 'FILM' as const };
      expect(classify({ ...movieQ, kind: 'tv' }, [film])).toMatchObject({ status: 'ambiguous', kpId: 60 });
    });

    it('needs the exact title and the same year', () => {
      expect(classify({ ...movieQ, year: 2020 }, [mini]).status).toBe('not_found');
      expect(classify({ ...movieQ, titles: ['Chernobyl Diaries'] }, [mini]).status).toBe('not_found');
      // TV_SHOW is not a film/series confusion
      expect(classify(movieQ, [{ ...mini, type: 'TV_SHOW' }]).status).toBe('not_found');
    });

    it('a film of the right kind and the same name still wins', () => {
      const film = { ...mini, kinopoiskId: 61, type: 'FILM' as const };
      expect(classify(movieQ, [mini, film])).toMatchObject({ status: 'confident', kpId: 61 });
    });
  });

  it('is ambiguous when two films of the same name and year exist', () => {
    const twin = kpItem({ kinopoiskId: 777, nameRu: 'Шоу Трумана', year: 1998 });
    const c = classify(q, [truman, twin]);
    expect(c.status).toBe('ambiguous');
    expect(c.reasons.join('\n')).toContain('1 other close candidate(s): 777');
  });

  it('stays confident when the namesake is further away in years', () => {
    const remake = kpItem({ kinopoiskId: 778, nameRu: 'Шоу Трумана', year: 2000 });
    expect(classify(q, [remake, truman]).kpId).toBe(252);
    expect(classify(q, [remake, truman]).status).toBe('confident');
  });

  it('respects the movie kind and reports what was filtered out', () => {
    const series = kpItem({ kinopoiskId: 6, nameRu: 'Друзья', nameOriginal: 'Friends', year: 1995, type: 'TV_SERIES' });
    // (the same year would be a kind_mismatch, below)
    const movieQ = { titles: ['Friends'], year: 1994, kind: 'movie' as const, imdbId: null };
    const c = classify(movieQ, [series]);
    expect(c.status).toBe('not_found');
    expect(c.reasons.join('\n')).toContain('1 similar titles of another kind');
    expect(classify({ ...movieQ, kind: 'tv' }, [series]).status).toBe('confident');
  });

  it('is ambiguous when the movie type is unknown', () => {
    expect(classify({ ...q, kind: null }, [truman]).reasons).toContain('movie type is unknown, kind not checked');
  });

  it('is not_found without results or similar titles', () => {
    expect(classify(q, []).reasons).toEqual(['no search results']);
    const c = classify(q, [kpItem({ kinopoiskId: 8, nameRu: 'Аватар', year: 1998 })]);
    expect(c.status).toBe('not_found');
    expect(c.kpId).toBeNull();
    expect(c.reasons[1]).toMatch(/^closest: 8 "Аватар"/);
    expect(classify({ ...q, titles: [] }, [truman]).reasons).toEqual(['movie has no title']);
  });

  it('trusts an equal imdb id', () => {
    const c = classify({ ...q, titles: ['Something else'], imdbId: 'tt0120382' }, [{ ...truman, imdbId: 'tt0120382' }]);
    expect(c.status).toBe('confident');
    expect(c.kpId).toBe(252);
  });

  it('ignores repeated items from two searches', () => {
    expect(classify(q, [truman, truman]).status).toBe('confident');
  });
});
