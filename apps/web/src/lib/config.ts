// Public origin of the site: absolute URLs in metadata (canonical, og:url, og:image) and share links.
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? process.env.SITE_URL ?? 'https://flicktips.ru').replace(
  /\/$/,
  '',
);

// The logo used as og:image when a page has no picture of its own
export const DEFAULT_OG_IMAGE = 'https://flicktips.ru/public/img/logo/1024x1024.png';

export const TMDB_POSTER_342 = 'https://image.tmdb.org/t/p/w342';

// Dates and times are shown in Moscow time on the server and in the browser alike, so SSR and hydration agree.
export const TIME_ZONE = 'Europe/Moscow';
