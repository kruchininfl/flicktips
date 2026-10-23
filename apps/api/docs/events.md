# Live updates (SSE): GET /api/events

Replaces the legacy socket.io channel. Legacy: `web/src/server.js` ran a socket.io server that re-broadcast to
every connected browser (`io.emit`) whatever PHP sent on a private channel; `UserController::toggleVote` was to send
`vote-changed` with `{success, data: {id, super, likes, neutral, dislikes}}` (that call was commented out, so in
production nothing was pushed), and `App.jsx` dispatched it into the vote reducers. Agreed v2 scope: vote changes
only.

Code: `src/events/bus.ts` (pub/sub), `src/routes/events.ts` (the stream), the publisher in `POST /api/me/votes`
(`src/routes/users.ts`). Browser: `apps/web/src/components/shell/LiveUpdates.tsx`. Tests: `src/routes/events.test.ts`.

## The stream

- `GET /api/events` with the `ft_session` cookie. Without a valid session: `401 {success: false, msg:
'authorization required'}` (guests open no stream; the site only connects for signed-in viewers). More than 16
  open streams of one user (tabs × devices): `429 {success: false, msg: 'too many open streams'}`.
- `200`, `Content-Type: text/event-stream; charset=utf-8`, `Cache-Control: no-cache, no-transform`,
  `X-Accel-Buffering: no`, `Connection: close` (the socket is not reused after the stream).
- First bytes: `retry: 5000` and the comment `: connected`, so the headers pass any proxy at once.
- `: ping` every 25 s.
- The server ends each stream after 15 min (± 10 %). The browser reconnects by itself and sends the cookie again,
  so a revoked or expired session stops receiving events within that time.
- A client that does not read (more than 256 KB queued) is dropped. On shutdown (`app.close()`, `preClose` hook)
  every stream is ended and its socket closed, so SIGTERM is not held up.

### Events

```
event: vote
data: {"id":42,"super":1,"likes":5,"neutral":0,"dislikes":2}
```

After every successful `POST /api/me/votes` (set, change or removal) all streams get the movie's new counters.
The voter's own streams (every tab and device of that user) also get the voter's flags
(`"isSuper":false,"isLiked":true,"isNeutral":false,"isDisliked":false`), so their other tabs show the vote as
active. Other users never see whose vote it was. Types: `VoteChangedEvent`, `LiveEventMap` in `@flicktips/shared`.

Not published: counters moved by an account merge (`POST /api/me/accounts/merge`); pages pick those up on reload.
Delivery is best effort: there are no event ids or replay, so a page misses the changes made while it was
disconnected, and two votes on one movie at the same moment may arrive in either order (each carries counters read
after its own commit).

## Pub/sub

`EventBus` (`publish(event)`, `subscribe(listener) → unsubscribe`) carries plain JSON `LiveEvent`s
(`{type: 'vote', userId, movie, flags}`); the stream route decides per connection what the viewer may see.
`buildApp` creates an in-process `MemoryEventBus` unless `deps.events` is given. That is enough for the single API
instance we run. With several instances, a Redis bus would `PUBLISH` the event JSON in `publish()` and run one
`SUBSCRIBE` connection per process that calls the local listeners; nothing else changes.

## Browser

`LiveUpdates` (in the app shell) opens `new EventSource('/api/events')` while `useViewer()` has a viewer and closes
it on sign-out. Each `vote` event goes to `updateMovie(id, patch)` in `lib/movie-store`, which every
`useMovieState()` copy of the movie on the page reads. When the browser gives up (the API was down and nginx/Next
answered 5xx, or 401/429), it opens a new EventSource after 5 s, doubling up to 5 min.

## nginx

Today `location /api` goes to PHP-FPM. When `/api` moves to the Fastify API, the stream needs its own location so
nginx neither buffers it nor times it out between heartbeats (the `X-Accel-Buffering: no` header already disables
buffering per response; the explicit config also covers caches and gzip):

```nginx
location = /api/events {
    proxy_pass http://127.0.0.1:3002;
    proxy_http_version 1.1;
    proxy_set_header Connection "";
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_buffering off;
    proxy_cache off;
    gzip off;
    # longer than the 25 s heartbeat
    proxy_read_timeout 1h;
}
```

Each open tab of a signed-in viewer holds one connection to nginx and one to the API; check `worker_connections`
if that ever gets near its limit. In dev, `next.config.ts` rewrites `/api/*` to the API and streams the response
through as is.
