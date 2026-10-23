// /sitemaps/sitemap.xml (index), /sitemaps/static.xml, /sitemaps/movies-N.xml, /sitemaps/people-N.xml. Built from
// the API's id lists (apps/api/docs/sitemap.md) instead of the legacy crawler (web/crawler.js).
import { publicServerApi } from '@/api/server';
import { isApiError } from '@/api/core';
import { SITE_URL } from '@/lib/config';
import { moviesSitemapXml, parseSitemapFile, peopleSitemapXml, sitemapIndexXml, staticSitemapXml } from '@/lib/sitemap';

// The ids change slowly and crawlers come rarely: the API answers are kept a day in the data cache.
const REVALIDATE_SECONDS = 86_400;
const api = publicServerApi(REVALIDATE_SECONDS);

const xml = (body: string) =>
  new Response(body, {
    headers: {
      'content-type': 'application/xml; charset=utf-8',
      'cache-control': `public, max-age=${REVALIDATE_SECONDS}, stale-while-revalidate=3600`,
    },
  });

const notFound = () => new Response('Not found', { status: 404, headers: { 'content-type': 'text/plain' } });

export async function GET(_request: Request, { params }: RouteContext<'/sitemaps/[file]'>) {
  const file = parseSitemapFile((await params).file);
  if (!file) return notFound();

  try {
    switch (file.kind) {
      case 'index':
        return xml(sitemapIndexXml(SITE_URL, await api.sitemap.index()));
      case 'static':
        return xml(staticSitemapXml(SITE_URL));
      case 'movies': {
        const data = await api.sitemap.movies(file.chunk);
        return data.ids.length ? xml(moviesSitemapXml(SITE_URL, data)) : notFound();
      }
      case 'people': {
        const data = await api.sitemap.people(file.chunk);
        return data.ids.length ? xml(peopleSitemapXml(SITE_URL, data)) : notFound();
      }
    }
  } catch (error) {
    if (isApiError(error, 404)) return notFound();
    console.error('sitemap', file, error);
    // a temporary failure: crawlers retry a 503 instead of dropping the URLs
    return new Response('Service unavailable', { status: 503, headers: { 'retry-after': '3600' } });
  }
}
