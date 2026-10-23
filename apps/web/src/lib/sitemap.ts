// sitemaps.org XML for app/sitemaps/[file]/route.ts: an index at /sitemaps/sitemap.xml (the URL robots.txt names,
// kept from the legacy crawler-made file) pointing to static.xml, movies-N.xml and people-N.xml.
import type { SitemapIndexResponse, SitemapMoviesResponse, SitemapPeopleResponse } from '@flicktips/shared';

export type SitemapFile =
  { kind: 'index' } | { kind: 'static' } | { kind: 'movies'; chunk: number } | { kind: 'people'; chunk: number };

// Public pages without an id (robots.txt keeps /user, /profile and /signin out).
export const STATIC_PATHS = ['/', '/about'];

export function parseSitemapFile(name: string): SitemapFile | null {
  if (name === 'sitemap.xml') return { kind: 'index' };
  if (name === 'static.xml') return { kind: 'static' };
  const match = /^(movies|people)-(0|[1-9]\d{0,5})\.xml$/.exec(name);
  if (!match) return null;
  return { kind: match[1] as 'movies' | 'people', chunk: Number(match[2]) };
}

const escapeXml = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[c]!);

const XML_HEAD = '<?xml version="1.0" encoding="UTF-8"?>\n';
const NS = 'http://www.sitemaps.org/schemas/sitemap/0.9';

function entry(tag: 'url' | 'sitemap', loc: string, lastmod?: string | null) {
  return `<${tag}><loc>${escapeXml(loc)}</loc>${lastmod ? `<lastmod>${lastmod}</lastmod>` : ''}</${tag}>`;
}

function urlset(siteUrl: string, entries: Iterable<[path: string, lastmod?: string | null]>) {
  const parts = [XML_HEAD, `<urlset xmlns="${NS}">\n`];
  for (const [path, lastmod] of entries) parts.push(entry('url', siteUrl + path, lastmod), '\n');
  parts.push('</urlset>\n');
  return parts.join('');
}

// Only chunks that have ids are listed, so no file in the index is empty.
export function sitemapIndexXml(siteUrl: string, index: SitemapIndexResponse): string {
  const files: [string, string | undefined][] = [['static.xml', undefined]];
  for (const { chunk, lastmod } of index.movies) files.push([`movies-${chunk}.xml`, lastmod]);
  for (const { chunk } of index.people) files.push([`people-${chunk}.xml`, undefined]);

  const parts = [XML_HEAD, `<sitemapindex xmlns="${NS}">\n`];
  for (const [file, lastmod] of files) parts.push(entry('sitemap', `${siteUrl}/sitemaps/${file}`, lastmod), '\n');
  parts.push('</sitemapindex>\n');
  return parts.join('');
}

export const staticSitemapXml = (siteUrl: string) =>
  urlset(
    siteUrl,
    STATIC_PATHS.map((path) => [path]),
  );

export function moviesSitemapXml(siteUrl: string, { ids, lastmod }: SitemapMoviesResponse): string {
  return urlset(
    siteUrl,
    ids.map((id, i) => [`/movie/${id}`, lastmod[i]]),
  );
}

export function peopleSitemapXml(siteUrl: string, { ids }: SitemapPeopleResponse): string {
  return urlset(
    siteUrl,
    ids.map((id) => [`/person/${id}`]),
  );
}
