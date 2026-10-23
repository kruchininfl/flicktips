# Sign-in, sessions and linked accounts: PHP → v2

Port of the PHP security layer (`api/app/services.php` OAuth/Security setup, `src/Services/{VkId,Yandex,
OAuthServiceProvider,MyOAuthServiceRegistry}.php`, `src/Security/*`, `src/Listeners/*`) and the sign-in parts of
`UserController` (`validateToken`, `linkAccount`, `mergeAccount`, `unlinkAccount`) and `UserRepository`.

Code: `src/routes/auth.ts` (routes), `src/auth/sessions.ts` (session table + cookie, `sessionResolver`),
`src/auth/csrf.ts`, `src/auth/signed.ts` (HMAC-signed payloads), `src/auth/oauth.ts` (provider interface),
`src/auth/providers/{vk-id,yandex}.ts` (real providers over `fetch`), `src/repositories/accounts.ts`
(create/find user by provider account, link, unlink, merge). Tests: `src/routes/auth.test.ts`,
`src/auth/providers/providers.test.ts`.

## Routes

| Old (PHP)                         | New (Fastify)                  | notes                                                              |
| --------------------------------- | ------------------------------ | ------------------------------------------------------------------ |
| `GET /auth/{service}`             | `GET /auth/:provider`          | `?next=/path` (relative only), `?link=1` to link, not sign in      |
| `GET /auth/{service}/callback`    | `GET /auth/:provider/callback` | provider redirect target                                           |
| `GET /auth/{service}/check`       | —                              | folded into the callback                                           |
| `GET /logout`                     | `POST /api/auth/logout`        | revokes the current session, clears the cookie                     |
| —                                 | `POST /api/auth/logout-all`    | revokes every session of the user                                  |
| `GET /api/checkUser/`             | `GET /api/me`                  | same `data` payload as `validateToken`                             |
| `GET /api/user/accounts/`         | `GET /api/me/accounts`         | (`src/routes/users.ts`) `{success, services: {vkontakte, yandex}}` |
| `POST /api/user/accounts/link/`   | `POST /api/me/accounts/link`   | `{proof}`                                                          |
| `POST /api/user/accounts/merge/`  | `POST /api/me/accounts/merge`  | `{proof}`                                                          |
| `POST /api/user/accounts/unlink/` | `POST /api/me/accounts/unlink` | `{service}`                                                        |

`:provider` is `vkontakte` or `yandex`; anything else is 404 `{success: false, err: 'Not found'}`.

The API runs behind nginx on the same domain as the Next.js site; `/auth/*` and `/api/*` go to the API, so every
path above is same-origin for the browser and the cookies below need no cross-site tricks.

## Sign-in flow

1. The site navigates (full page, no popup, no fetch) to `/auth/vkontakte?next=/movies/42` or
   `/auth/yandex?next=…`. `next` must be a relative path (`/…`, not `//…`, no scheme, no backslashes or control
   characters, ≤ 2000 chars); anything else is treated as `/`.
2. The API makes a random 48-hex `state`, stores `{provider, state, next, link-user}` in the HMAC-signed cookie
   `ft_oauth` (httpOnly, SameSite=Lax, Path=/auth, 10 min, Secure in prod) and redirects to the provider:
   - VK ID: `https://id.vk.ru/authorize` with PKCE (`code_challenge = S256(code_verifier)`,
     `code_verifier = base64url(HMAC-SHA256(VKONTAKTE_API_SECRET, state))`, as `VkId.php` did), scope
     `vkid.personal_info`.
   - Yandex ID: `https://oauth.yandex.ru/authorize` (scopes are set on the app in the cabinet).
3. The provider sends the browser to `/auth/:provider/callback?code&state(&device_id)`. The API verifies the
   cookie (signature, age, provider) and that `state` equals the one in the cookie (constant time), then
   exchanges the code (`https://id.vk.ru/oauth2/auth` with `device_id` and the verifier, or
   `https://oauth.yandex.ru/token` with the client secret) and reads the profile (`id.vk.ru/oauth2/user_info`
   or `login.yandex.ru/info?format=json`). The identity is mapped like the PHP `OAuthUserInfoListener`: VK
   `first_name last_name`, `sex` 1/2 → female/male, `avatar`; Yandex `real_name | display_name | login`,
   `sex` when male/female, `https://avatars.yandex.net/get-yapic/<default_avatar_id>/islands-200` unless the
   avatar is empty.
4. The user is found by `user.<provider>_id` or created (`INSERT … ON DUPLICATE KEY UPDATE id = LAST_INSERT_ID(id)`,
   exactly as `OAuthUserProvider::createUser`; an existing user's name, avatar and gender are not touched, as
   before). A session row is inserted, the `ft_session` cookie is set and the browser is redirected to `next`.
   If the browser already had a valid session, that session is revoked first (one session per browser).
5. On failure the browser lands on `/signin?error=<code>&next=<next>`: `state` (missing/forged/expired cookie,
   state mismatch, provider mismatch), `denied` (the user cancelled at the provider), `provider` (token or profile
   request failed), `params` (callback missing `code`/`device_id`). Nothing is created in that case.

The provider HTTP calls go through `AppDeps.oauth` (`OAuthProvider.authorizationUrl` / `fetchIdentity`); tests use
fakes, `main.ts` wires `VkIdProvider` and `YandexProvider` from `VKONTAKTE_API_KEY`/`VKONTAKTE_API_SECRET`,
`YANDEX_CLIENT_ID`/`YANDEX_CLIENT_SECRET`.

## Session cookie

- Name `ft_session`, value: 32 random bytes, base64url. The table `session` (migration 001) stores
  `id = SHA-256(token)` (hex), `user_id`, `created_at`, `last_seen_at`, `expires_at`, `user_agent`. The clear
  token never touches the database or the logs.
- Attributes: `HttpOnly; SameSite=Lax; Path=/; Max-Age=31536000`, plus `Secure` when `APP_ENV=prod` (dev on
  `http://localhost` would otherwise lose the cookie). Not readable by JS; nothing to put in headers.
- Lifetime: one year sliding, like the PHP `cookie_lifetime` (31536000). Every request with a session whose
  `last_seen_at` is older than 5 minutes pushes `last_seen_at` and `expires_at` forward (one extra `UPDATE` per 5
  min per session, not per request). Expired rows are ignored and deleted lazily on every sign-in.
- Revocation is immediate: `logout` deletes the row, `logout-all` every row of the user, merging an account
  deletes the merged-away user's rows. The old `user.token` column is no longer used for anything (new users have
  `token = NULL`); every PHP-era login is dropped at the switch.
- `request.viewer` is `{id, sessionId}`; `requireViewer()` answers `401 {success: false, msg: 'authorization
required'}` as before. The legacy `uid`/`access-token` header resolver is gone.

## CSRF

Three layers:

1. `SameSite=Lax` on `ft_session`: browsers do not attach it to cross-site POST/PUT/PATCH/DELETE or to cross-site
   subresource GETs.
2. Origin check (`src/auth/csrf.ts`, run in `onRequest` for every non-GET/HEAD/OPTIONS request): when the request
   carries an `Origin` header it must equal `SITE_URL` exactly (`null` is rejected); otherwise, when it carries
   `Sec-Fetch-Site`, it must be `same-origin` or `none`. A request with neither header comes from a non-browser
   client, where ambient cookies are not a concern, and passes. Violations get
   `403 {success: false, msg: 'cross-site request rejected'}` before any route code runs.
3. OAuth `state`: a login cannot be completed with a `code` the browser did not ask for (login CSRF / code
   injection), because the state lives in the signed `ft_oauth` cookie of the browser that started the flow.
   The same cookie binds VK's PKCE verifier to that browser.

`SITE_URL` (new config key, default `https://flicktips.ru`) is normalized to an origin; it is also the base of the
OAuth redirect URIs. For the local stack set `SITE_URL=https://flicktips.local`.

## Linking and merging accounts

Same rules as PHP (`AccountLinkProof`, `linkAccount`, `mergeAccount`, `unlinkAccount`, `UserRepository::mergeInto`):

1. The profile page navigates to `/auth/yandex?link=1&next=/profile/accounts` while signed in (without a session
   it is sent to `/signin?next=…`). The flow cookie remembers the user id.
2. On the callback the identity is **not** signed in or created. If the browser is still signed in as the same
   user, the API redirects to `next?link_proof=<proof>`, where `proof` is an HMAC-signed
   `{service, identity: {id, username, avatar, gender}, sid}` valid for 15 minutes (`AccountLinkProof::TTL`).
   `sid` is the id of the session that started the flow, so a proof leaked from a URL is useless in any other
   browser (PHP bound it to the PHP session with a nonce; a nonce is not needed since the session id does the
   job). Otherwise the redirect is `next?link_error=<state|denied|provider|params|session>`.
3. The page POSTs `{proof}` to `/api/me/accounts/link`:
   - the account is free → it is linked: `{success, status: 'linked', service, services}`;
   - the account already belongs to this user → `status: 'linked'` (no-op);
   - this user already has another account of that service → `409 {msg: 'another account of this service is already linked'}`;
   - the account belongs to someone else → `{success: true, status: 'conflict', service, merge}` where `merge` is
     `{user, votes, bookmarks, following, conflicts, blocking}` exactly as `getMergeSummary` returned it;
   - bad/expired/foreign proof → `400 {msg: 'sign-in expired, try again'}` (the message the legacy page translates).
4. To merge, the page POSTs the same `proof` to `/api/me/accounts/merge`. `mergeInto` is ported statement for
   statement: votes (newer wins, counters adjusted), bookmarks, follows (follow beats unfollow, rows between the two
   are dropped), Telegram group memberships, `tg_post` and `vote_event` rows move over; the current user takes the
   other's sign-in methods, Telegram link, invite code and avatar when it has none and the earlier
   `registration_date`; the other user row is deleted. New in v2: **all sessions of the merged-away user are
   revoked** in the same transaction. Refusals: `409 'nothing to merge'` (account free or already mine),
   `409 'accounts cannot be merged'` (`blocking` non-empty, i.e. both users have different accounts of one
   service).
5. `/api/me/accounts/unlink {service}`: `400 'unknown service'`, `409 'cannot unlink the last sign-in method'`,
   else `{success, services}`. Unlinking does not end the session.

## What the frontend must do

- Start sign-in with a full-page navigation (`<a href>` or `window.location`) to `/auth/vkontakte?next=…` or
  `/auth/yandex?next=…`; `next` = the current path. No popup, no `auth_origin_url`, no token parsing.
- Credentials are cookies: `fetch('/api/…', {credentials: 'same-origin'})`, nothing in headers. Server-side (SSR)
  calls forward the incoming `Cookie` header to the API.
- On load / in SSR call `GET /api/me`: 200 `{success: true, data}` = signed in, 401 = anonymous.
- Logout: `POST /api/auth/logout`, then drop the user from state. `POST /api/auth/logout-all` for "sign out
  everywhere".
- Account page: navigate to `/auth/<service>?link=1&next=/profile/accounts`; on return read `link_proof` (or
  `link_error`) from the URL, POST it to `/api/me/accounts/link`, show the merge dialog on `status: 'conflict'`
  and POST the same proof to `/api/me/accounts/merge` on confirmation; remove the proof from the URL afterwards.
- A `/signin` page that shows `?error=` (`state`, `denied`, `provider`, `params`) and offers to retry with
  `?next=`.
- Send a browser `Origin` as usual (browsers do); nothing to add for CSRF.

## Redirect URLs to register

Same apps as before, new URLs (register both for a provider; the API picks `SITE_URL + /auth/<provider>/callback`):

| Provider                                            | Production                                     | Local stack                                       |
| --------------------------------------------------- | ---------------------------------------------- | ------------------------------------------------- |
| VK ID (id.vk.ru cabinet, "Доверенный redirect URL") | `https://flicktips.ru/auth/vkontakte/callback` | `https://flicktips.local/auth/vkontakte/callback` |
| Yandex ID (oauth.yandex.ru, "Redirect URI")         | `https://flicktips.ru/auth/yandex/callback`    | `https://flicktips.local/auth/yandex/callback`    |

These are the URLs the PHP API already used (`.env.example` names the Yandex one), so nothing changes in the
cabinets unless the site moves to another host; `www.flicktips.ru` is not accepted as `SITE_URL` origin, so nginx
must keep redirecting `www` to the bare domain before `/auth/*`.

## Intentional differences from PHP

- Sessions instead of `user.token` + `uid`/`access-token` headers; cookie instead of the redux-oauth
  `authHeaders` cookie; everyone signs in again once.
- The login flow state lives in a signed cookie, not a server-side PHP session (`/tmp` files); there is no
  `/auth/{service}/check` hop and no `auth_origin_url` — `next` is a relative path only (PHP accepted any
  `http(s)://flicktips.ru/...` URL and appended `auth_token`/`uid` to it).
- `GET /api/me` answers `401 {success: false, msg: 'authorization required'}` for an anonymous request; PHP's
  `checkUser` answered `200 {success: false}`.
- Signing in from a browser that already has a session revokes that session (PHP just issued a new token, which also
  invalidated the old one for every device since `user.token` was per user; now other devices stay signed in).
- Failed sign-ins redirect to `/signin?error=…` instead of Symfony's default failure page.
- `AccountLinkProof` is bound to the session id instead of a PHP-session nonce, and is not consumed after use:
  replaying it is harmless (`linked` again / `nothing to merge`) and it expires after 15 minutes.
- Merging revokes the merged-away user's sessions (there was nothing to revoke in PHP: the row deletion already
  killed `user.token`).
- The CSRF origin check is new (PHP relied on the custom headers for `/api` and Symfony's `_csrf_token` for
  `/auth`, which the legacy client never sent).
- Provider tokens are not stored (`vkontakte_token`/`yandex_token` stay `NULL`, as in the latest PHP).
- Bodies are read from JSON only (PHP's `$request->get()` also looked at the query string).
