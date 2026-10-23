import type { KpVideo } from '@flicktips/kinopoisk';

// YouTube video id from the URL forms Кинопоиск returns (watch?v=, youtu.be/, /embed/, /v/).
export function youtubeKey(url: string): string | null {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return null;
  }
  const host = u.hostname.replace(/^(www\.|m\.)/, '');
  let key: string | null | undefined = null;
  if (host === 'youtu.be') key = u.pathname.split('/')[1];
  else if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
    key = u.searchParams.get('v') ?? /^\/(?:embed|v|shorts)\/([^/?#]+)/.exec(u.pathname)?.[1];
  }
  return key && /^[\w-]{6,}$/.test(key) ? key : null;
}

// The legacy `tmdb_trailers` items ("YouTube:<key>", from TMDB's site:key) built from Кинопоиск
// videos: YouTube links only (whatever `site` says), without duplicates.
export function trailersFromKp(videos: KpVideo[]): string[] {
  const keys = new Set<string>();
  for (const video of videos) {
    const key = youtubeKey(video.url);
    if (key) keys.add(key);
  }
  return [...keys].map((key) => `YouTube:${key}`);
}
