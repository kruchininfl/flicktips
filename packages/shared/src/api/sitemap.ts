// GET /api/sitemap, /api/sitemap/movies/:chunk, /api/sitemap/people/:chunk (apps/api/docs/sitemap.md).

// Chunk N holds the ids N * chunkSize + 1 … (N + 1) * chunkSize that have a public page.
export interface SitemapChunk {
  chunk: number;
  count: number;
  // newest lastmod in the chunk (movies only), YYYY-MM-DD
  lastmod?: string;
}

// Only chunks with at least one id are listed.
export interface SitemapIndexResponse {
  success: true;
  chunkSize: number;
  movies: SitemapChunk[];
  people: SitemapChunk[];
}

export interface SitemapMoviesResponse {
  success: true;
  chunk: number;
  // ascending
  ids: number[];
  // lastmod of ids[i] (YYYY-MM-DD) or null; parallel arrays keep the payload small
  lastmod: (string | null)[];
}

export interface SitemapPeopleResponse {
  success: true;
  chunk: number;
  // ascending
  ids: number[];
}
