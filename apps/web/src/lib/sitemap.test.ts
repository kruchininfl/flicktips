import { describe, expect, it } from 'vitest';

import { moviesSitemapXml, parseSitemapFile, peopleSitemapXml, sitemapIndexXml, staticSitemapXml } from './sitemap';

const SITE = 'https://flicktips.ru';

describe('parseSitemapFile', () => {
  it('knows the index, the static file and the numbered chunks', () => {
    expect(parseSitemapFile('sitemap.xml')).toEqual({ kind: 'index' });
    expect(parseSitemapFile('static.xml')).toEqual({ kind: 'static' });
    expect(parseSitemapFile('movies-0.xml')).toEqual({ kind: 'movies', chunk: 0 });
    expect(parseSitemapFile('people-27.xml')).toEqual({ kind: 'people', chunk: 27 });
  });

  it('rejects anything else, including padded numbers', () => {
    for (const name of ['movies-01.xml', 'movies-.xml', 'movies-1', 'users-0.xml', 'people-1234567.xml', 'x.xml']) {
      expect(parseSitemapFile(name), name).toBeNull();
    }
  });
});

describe('sitemap XML', () => {
  it('builds the index from the non-empty chunks, with the movies’ lastmod', () => {
    const xml = sitemapIndexXml(SITE, {
      success: true,
      chunkSize: 50_000,
      movies: [
        { chunk: 0, count: 3, lastmod: '2026-04-20' },
        { chunk: 2, count: 1 },
      ],
      people: [{ chunk: 1, count: 5 }],
    });
    expect(xml).toBe(
      '<?xml version="1.0" encoding="UTF-8"?>\n' +
        '<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
        '<sitemap><loc>https://flicktips.ru/sitemaps/static.xml</loc></sitemap>\n' +
        '<sitemap><loc>https://flicktips.ru/sitemaps/movies-0.xml</loc><lastmod>2026-04-20</lastmod></sitemap>\n' +
        '<sitemap><loc>https://flicktips.ru/sitemaps/movies-2.xml</loc></sitemap>\n' +
        '<sitemap><loc>https://flicktips.ru/sitemaps/people-1.xml</loc></sitemap>\n' +
        '</sitemapindex>\n',
    );
  });

  it('lists the static pages, movies with lastmod where known, and people', () => {
    expect(staticSitemapXml(SITE)).toContain(
      '<url><loc>https://flicktips.ru/</loc></url>\n<url><loc>https://flicktips.ru/about</loc></url>\n</urlset>',
    );
    expect(moviesSitemapXml(SITE, { success: true, chunk: 0, ids: [10, 12], lastmod: ['2026-04-20', null] })).toContain(
      '<url><loc>https://flicktips.ru/movie/10</loc><lastmod>2026-04-20</lastmod></url>\n' +
        '<url><loc>https://flicktips.ru/movie/12</loc></url>\n',
    );
    expect(peopleSitemapXml(SITE, { success: true, chunk: 0, ids: [20] })).toContain(
      '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n<url><loc>https://flicktips.ru/person/20</loc></url>\n',
    );
  });

  it('escapes the site URL', () => {
    expect(staticSitemapXml('https://a.test/?x=1&y=2')).toContain('<loc>https://a.test/?x=1&amp;y=2/about</loc>');
  });
});
