# Sitemap data

New in v2. The legacy site wrote `/sitemaps/sitemap.xml` with a crawler (`web/crawler.js`, `sitemap-generator`);
now the Next.js site builds the files from the database through three lean API routes. Code:
`src/routes/sitemap.ts`, `src/repositories/sitemap.ts`; the XML is `apps/web/app/sitemaps/[file]/route.ts` and
`apps/web/src/lib/sitemap.ts`. Tests: `src/routes/sitemap.test.ts`, `apps/web/src/lib/sitemap.test.ts`.

## Files on the site

`robots.txt` keeps pointing to `/sitemaps/sitemap.xml`, now a sitemap index:

| URL                      | contents                                                                    |
| ------------------------ | --------------------------------------------------------------------------- |
| `/sitemaps/sitemap.xml`  | `<sitemapindex>`: `static.xml`, then every non-empty movie and people chunk |
| `/sitemaps/static.xml`   | `/`, `/about`                                                               |
| `/sitemaps/movies-N.xml` | `/movie/:id` of chunk N, with `<lastmod>` where known                       |
| `/sitemaps/people-N.xml` | `/person/:id` of chunk N (no date in the `people` table)                    |

`/user`, `/profile`, `/signin` and `/invite` pages are not listed (robots.txt disallows the first three; invites
are personal links). Unknown names and empty chunks answer 404. When the API fails, the route answers 503 with
`Retry-After: 3600`, so crawlers retry instead of dropping URLs.

Caching: the API answers are kept in the Next.js data cache for a day (`publicServerApi(86400)`, no cookies
forwarded); the XML responses carry `Cache-Control: public, max-age=86400, stale-while-revalidate=3600`.

## Chunks

Chunk `N` holds the ids `N * 50000 + 1 … (N + 1) * 50000`, so a file never has more than the protocol's 50 000 URLs
(about 3 MB of XML at most) and a URL keeps its contents when rows are added elsewhere. Today that is 3 movie
chunks (~100k movies) and ~29 people chunks (~1.4M people).

An id is listed only if its page exists, with the same conditions the pages 404 on:

- movie: `movie.suspend <> 1` (`getFilm` → `loadMovies(skipSuspended)`);
- person: `people.suspend <> 1` and at least one `movie_people` row whose movie is not suspended (`getPerson`
  returns null without movies).

`lastmod` of a movie is the later of `kp_check_date` (kp-parser refreshed its data) and the date of its newest
`movie_vote.timestamp`, as `YYYY-MM-DD`; null when it has neither. A changed vote keeps its old timestamp and a
removed vote leaves no trace, so this is a lower bound. People have no date column, so they get no `lastmod`.

## Routes

| Route                            | Response                                                                                       |
| -------------------------------- | ---------------------------------------------------------------------------------------------- |
| `GET /api/sitemap`               | `{success, chunkSize: 50000, movies: [{chunk, count, lastmod?}], people: [{chunk, count}]}`    |
| `GET /api/sitemap/movies/:chunk` | `{success, chunk, ids: number[], lastmod: (string \| null)[]}`: parallel arrays, ascending ids |
| `GET /api/sitemap/people/:chunk` | `{success, chunk, ids: number[]}`                                                              |

Only non-empty chunks are in the index. `:chunk` is a non-negative integer up to the last chunk an `int` id can
reach; anything else is `404 {success: false, msg: 'Not found'}`. A chunk beyond the data answers 200 with empty
arrays. Parallel arrays instead of `{id, lastmod}` objects keep a full movie chunk near 1 MB of JSON, below the
Next.js data cache's 2 MB item limit.

Responses carry `Cache-Control: public, max-age=3600` and are also kept in process for an hour (`TtlCache`, at most
8 entries: the index and a few chunks; concurrent requests share one query). The index is the expensive query
(one `EXISTS` probe per person over the whole `people` table, using the `movie_people.people_id` foreign-key
index); a chunk reads at most 50 000 rows by primary key range.
