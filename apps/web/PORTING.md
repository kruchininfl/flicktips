# Porting `web/` to `apps/web`

How a legacy page (`web/src/components/*Page`, `web/src/partitions/*`) becomes a Next.js 16 App Router page. The
goal is parity: same URLs, same markup and class names, same styles, same texts. No redesign; deviations are
called out in the code with a short comment.

Next.js 16 differs from older versions (async `params`/`searchParams`/`headers()`, `proxy.ts` instead of
middleware, Turbopack by default). Check `node_modules/next/dist/docs/` before relying on memory.

## Layout

```
app/                        routes (one folder per legacy URL), layout.tsx = legacy App shell
proxy.ts                    trailing-slash rules: /profile/* with a slash, everything else without (308)
next.config.ts              dev rewrites /api, /auth -> API_INTERNAL_URL; /poster/kp -> kinopoiskapiunofficial
public/public/              legacy /public/* files (favicons, logo, placeholders) at the same URLs
src/api/                    typed API client: endpoints.ts (all calls), server.ts, browser.ts, core.ts
src/viewer/                 getViewer/requireViewer (server), ViewerProvider/useViewer (client), sign-in URLs
src/components/gui/         legacy Gui/ primitives (Button, Icon, Modal, Tooltip, Toggler, Spinner, ...)
src/components/movie/       legacy movie partitions (MoviePreview, MovieStat, MovieVotes, MovieBookmark, ...)
src/components/shell/       header, tab bar, search, loading bar, UiProvider (sign-in/search popups)
src/components/{auth,invite,telegram}/   sign-in panel/modal, invite popup, Telegram block
src/lib/                    helpers replacing moment/js-cookie/Immutable logic (dates, movies, cookies, metadata)
src/styles/                 _reset, _base (verbatim), app.scss (App.scss), pages.scss (legacy page sheets)
```

DTO types live in `@flicktips/shared` (`packages/shared/src/api/*`); import them from there or `@/api/types`.

## Server vs client components

- Pages (`page.tsx`) are **Server Components**: fetch on the server with `serverApi` and render the HTML. This
  replaces redux-connect `asyncConnect` + the Redux store; there is no global store.
- Interactive pieces (votes, bookmarks, popups, forms, anything with state or event handlers) are **Client
  Components** (`'use client'`) that receive plain JSON props from the page. Keep them as small as practical.
- Components without hooks or handlers (e.g. `MoviePreview`) work in both; they just render.
- After a client mutation that changes server-rendered data, call `router.refresh()` (or update the movie store,
  below). `useViewerActions().updateProfile()` already does this for the profile.

## Data fetching

```tsx
// app/movie/[id]/page.tsx
import { orNotFound, serverApi } from '@/api/server';

export default async function MoviePage({ params }: PageProps<'/movie/[id]'>) {
  const { id } = await params;
  const { data: movie } = await orNotFound(serverApi.movies.get(Number(id)));
  return <MovieView movie={movie} />;
}
```

- `serverApi` (server only) calls `API_INTERNAL_URL` (default `http://127.0.0.1:3002`) and forwards the visitor's
  `cookie` and `user-agent`, with `cache: 'no-store'`. Every page is dynamic; that is intended.
- `orNotFound(promise)` turns an API 404 into the Next.js 404 page. Other errors throw (error boundary / 500).
- Fetch in parallel with `Promise.all` when a page needs several calls. `getViewer()` is `cache()`d per request,
  so the layout, page and `generateMetadata` can all call it for free. Wrap other calls shared between
  `generateMetadata` and the page in `cache()` the same way.
- `api` (browser, `@/api/browser`) uses same-origin `/api/...` with `credentials: 'include'`. A 401 opens the
  sign-in popup (event `flicktips:unauthorized`) unless the call passes `signInOn401: false`.
- Errors are `ApiError` (`status`, `body`, `path`); check them with `isApiError(error, 404)`.
- Add new endpoints to `src/api/endpoints.ts` (one definition for both transports) and their types to
  `packages/shared`. Never call `fetch('/api/...')` directly from components.
- Inside a `try/catch` around server calls, call `unstable_rethrow(error)` first so Next.js control flow
  (`redirect`, `notFound`, dynamic rendering) passes through (see `src/viewer/server.ts`).

## Viewer and auth

- Server: `const viewer = await getViewer()` (`null` for guests or when the API is down). Pages behind
  `requireAuth` call `await requireViewer('/profile/friends/')` with their own path; guests are redirected to
  `/signin?next=<path>`.
- Client: `useViewer()` gives the profile; `useViewerActions()` has `setViewer`, `updateProfile(patch)` and
  `logout()`. `useUi()` has `openSignIn()`, `openSearch()`, `startLoading()/doneLoading()`.
- Sign-in is a full navigation to `/auth/:provider?next=...` (`signInUrl()`); use `OAuthButton`, `SignInButton`
  or `openSignIn()`. Linking an account adds `&link=1` (`signInUrl(provider, next, true)`).
- In dev the API must run with `SITE_URL=http://localhost:3001`, or its CSRF Origin check rejects POSTs.

## Metadata

The legacy pages set titles and tags through `<Helmet>`. Use `pageMetadata()`:

```tsx
export async function generateMetadata({ params }: PageProps<'/movie/[id]'>): Promise<Metadata> {
  const { id } = await params;
  const { data: movie } = await orNotFound(getMovie(Number(id))); // getMovie = cache(serverApi.movies.get)
  return pageMetadata({
    title: `${movie.title} (${yearOf(movie.release_date)}) — FlickTips`,
    description: movie.description,
    path: `/movie/${movie.id}`,
    image: getPosterUrl(movie, true),
    type: 'video.movie',
  });
}
```

It produces the full title (no template), canonical URL, `og:*`, `vk:image` and `twitter:*`. Pages behind auth
pass `noindex: true`. Copy the texts from the legacy Helmet calls exactly.

## Styling

- Styles stay **global SCSS with the legacy BEM class names**; no CSS modules or Tailwind. Copy the legacy
  `.scss` next to the component and keep it as close as possible to the original. Start each file with
  `@use 'base' as *;` (variables and mixins from `src/styles/_base.scss`, resolved through `sassOptions.loadPaths`).
- Sass module syntax changes only: `lighten($c, 10%)` -> `color.adjust($c, $lightness: 10%)` (with
  `@use 'sass:color'`), a trailing `@import "XTablets";` -> `@include meta.load-css('x-tablets');` so the tablet
  rules keep their place in the cascade. Lightning CSS rejects IE hacks such as `*zoom`; drop them.
- Image URLs are absolute (`/public/img/...`); add files under `public/public/`.
- Cascade order matters (many rules have equal specificity). The legacy build put all CSS into one file:
  partitions first, then `App.scss`, then each page's sheet in `web/src/routes.js` order. Here:
  - a **partition/component** imports its own `.scss` from its `.tsx` (loaded before `app.scss`);
  - a **page sheet** (`LastGradedPage.scss`, `MoviePage.scss`, `Profile.scss`, ...) goes to
    `src/styles/pages/_name.scss` and is loaded from `src/styles/pages.scss` at its TODO slot, not imported
    from `page.tsx`. Those sheets contain global selectors that apply on every page, as they did before
    (`LayoutPage.scss` sets `.btn { margin }` site-wide, for example).
- Icons: the IcoMoon font became inline SVG. `<Icon name="cross" />` renders `<i class="icn icn_cross">` with the
  glyph; `<Glyph name="..." />` is the bare `<svg>` for markup that already has its own `.icn` element. Glyph
  names are the legacy `icn_*` suffixes (`src/components/gui/icons/glyphs.ts`, generated from
  `web/public/icons/selection.json`).

## Primitives (legacy -> here)

| Legacy                                                          | Port                                                             | Notes                                                                                                                      |
| --------------------------------------------------------------- | ---------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `Gui/Button`                                                    | `gui/Button`                                                     | `to` -> `next/link`, `href` -> `<a>`, otherwise `span[role=button]`; `color`, `size`, `variant`, `icn`, `loading`, `block` |
| `Gui/Spinner`                                                   | `gui/Spinner`                                                    | `active`, `size="small"`                                                                                                   |
| `Gui/Forms` toggler                                             | `gui/Toggler`                                                    |                                                                                                                            |
| `Gui/VoteIcon`                                                  | `gui/VoteIcon`                                                   | `vote` 0-3 (API ids), `active`                                                                                             |
| icon font `.icn_*`                                              | `gui/Icon`, `gui/Glyph`                                          | inline SVG                                                                                                                 |
| `Userpic` markup                                                | `gui/Userpic`                                                    |                                                                                                                            |
| react-modal                                                     | `gui/Modal`                                                      | same DOM/classes (`ReactModal__*`), `isOpen`, `onRequestClose`                                                             |
| react-tippy                                                     | `gui/Tooltip`                                                    | `.tippy-*` classes; no animateFill circle                                                                                  |
| react-lazy-load                                                 | `gui/LazyLoad`                                                   | `offset`, `height`                                                                                                         |
| react-custom-scrollbars                                         | `gui/CustomScrollbars`                                           | simplified: vertical thumb only                                                                                            |
| react-share VK                                                  | `invite/VkShareButton`                                           |                                                                                                                            |
| react-redux-loading-bar                                         | `shell/LoadingBar`                                               | runs on internal link clicks and `useUi().startLoading()`                                                                  |
| `partitions/MoviePreview`                                       | `movie/MoviePreview`                                             | server or client; `votesFilter`, `children`                                                                                |
| `MovieStat`, `MovieStatExternal`, `MovieVotes`, `MovieBookmark` | `movie/*`                                                        |                                                                                                                            |
| `HeaderSearch`, `HeaderProfile`, `TabBar`                       | `shell/*`                                                        |                                                                                                                            |
| `AuthButtons`, `SignInPage`                                     | `auth/SignInButton`, `OAuthButton`, `SignInPanel`, `SignInModal` |                                                                                                                            |
| `InviteButton`, `TelegramBlock`                                 | `invite/InviteButton`, `telegram/*`                              |                                                                                                                            |
| moment                                                          | `lib/dates`                                                      | Moscow time (`TIME_ZONE`) on server and client, so hydration matches                                                       |
| js-cookie                                                       | `lib/cookies`                                                    |                                                                                                                            |
| Immutable / redux models                                        | plain objects + `lib/movies`                                     | `getPosterUrl`, `getLastVoteTime`, `genreNames`, `VOTE_NAMES`                                                              |

Movie votes and bookmarks: `useVote()` / `useToggleBookmark()` (guests get the sign-in popup) write the new
counters into `lib/movie-store`, and `useMovieState(movie)` reads them, so every copy of a movie on the page
updates at once. Server-sent vote updates (the legacy socket `vote-changed`) feed `updateMovie()` too:
`shell/LiveUpdates` keeps an `EventSource` on `/api/events` while a viewer is signed in (`apps/api/docs/events.md`).

Relative times (`timeAgo`, `formatVoteTime`) depend on "now": render them in a client component with
`suppressHydrationWarning` on the element, as `MovieVotes` and `MoviePreview` do.

## Checklist for a page

1. Read the legacy page, its partitions, its `asyncConnect` calls and its Helmet tags.
2. Add missing endpoints to `src/api/endpoints.ts` and DTO types to `packages/shared`.
3. Replace the `PortTodo` placeholder: a Server Component page fetching with `serverApi` (+ `orNotFound`).
4. `generateMetadata` / `metadata` with `pageMetadata()`, texts copied from the legacy page.
5. Port partitions into `src/components/<area>/` (client only where they need state or handlers), copying the
   markup and class names; reuse the primitives above.
6. Port the SCSS (component sheets next to components, the page sheet into `styles/pages/` + `pages.scss`).
7. Keep URLs, query parameters, redirects and status codes (404 for missing items) as they were.
8. Compare with the legacy page in a browser at desktop and 375px widths, signed in and as a guest.
9. `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`, `pnpm format:check` from the repo root.

## Running

```sh
pnpm --filter @flicktips/api dev   # port 3002; needs DB_* env and SITE_URL=http://localhost:3001
pnpm --filter @flicktips/web dev   # port 3001; /api and /auth are rewritten to API_INTERNAL_URL
```

`/layout` is the GUI kit page for checking primitives.
