# Web Push notifications

New in v2, part of the PWA that replaces the Cordova app (the Cordova build had no push). Code: `src/routes/push.ts`
(routes), `src/push/sender.ts` (`PushSender`, `WebPushSender` over the `web-push` package), `src/push/notifier.ts`
(`PushNotifier`: what is sent to whom), `src/repositories/push.ts`. Table `push_subscription` (migration
`packages/db/migrations/002-push-subscriptions.sql`). Tests: `src/routes/push.test.ts`, `src/push/sender.test.ts`.
Browser side: `apps/web/src/components/pwa/` and the service worker `apps/web/src/sw/sw.ts`.

## Setup (owner)

1. Apply the migration by hand (it is not applied anywhere yet):
   `mysql flicktips_test < packages/db/migrations/002-push-subscriptions.sql`, then the same for `flicktips`.
2. Generate one VAPID key pair and keep it (a new pair invalidates every browser subscription):
   `pnpm --filter @flicktips/api exec web-push generate-vapid-keys` (or `npx web-push generate-vapid-keys`).
3. Put them in the server `.env` (never in git; `.env.example` lists the names):
   `WEB_PUSH_PUBLIC_KEY=<public key>`, `WEB_PUSH_PRIVATE_KEY=<private key>`,
   `WEB_PUSH_SUBJECT=mailto:support@flicktips.ru` (a `mailto:` or `https:` contact the push services may use).

Without all three, push is off: `GET /api/push/key` answers `publicKey: null`, the site shows no toggle, and
subscribing answers `503 {success: false, msg: 'push notifications are not configured'}`. The API server must be
able to make outgoing HTTPS requests to the push services below.

## Routes

| Route                                              | Auth    | Answer                                                     |
| -------------------------------------------------- | ------- | ---------------------------------------------------------- |
| `GET /api/push/key`                                | none    | `{success, publicKey: string \| null}`                     |
| `GET /api/me/push?endpoint=`                       | session | `{success, subscribed}`: this endpoint, this user, session |
| `POST /api/me/push/subscriptions` `{subscription}` | session | `{success, subscribed: true}`                              |
| `DELETE /api/me/push/subscriptions` `{endpoint}`   | session | `{success, subscribed: false}` (also when nothing matched) |

- `subscription` is `PushSubscription.toJSON()`: `{endpoint, expirationTime?, keys: {p256dh, auth}}`; keys are
  base64url (≤ 255 chars). Bad input: `400 {success: false, msg}`. Without a session: `401`.
- CSRF: the POST and DELETE go through the same origin check as every state-changing route (`auth.md`, "CSRF").
- `endpoint` must be `https://` on a known push service, so the API never POSTs to a host a client picked
  (SSRF): `fcm.googleapis.com`, `android.googleapis.com` (Chrome and Chromium browsers), `*.push.services.mozilla.com`
  (Firefox), `*.push.apple.com` (Safari, iOS 16.4+ home-screen apps), `*.notify.windows.com` (Edge). A browser with
  another push service gets `400 'subscription.endpoint: unsupported push service'`; add its host to
  `PUSH_SERVICE_HOSTS` if that shows up.

## Storage

`push_subscription.id` is SHA-256 of the endpoint, so one browser has one row. Subscribing again updates it; when
another user subscribes from the same browser, the row moves to that user. Each row keeps the `session_id` of the
sign-in that created it, and messages go only to rows whose session still exists and has not expired: signing out,
"sign out everywhere", an account merge or expiry stop the pushes at once, without touching the auth code. The web
client also unsubscribes the browser on sign-out. On every subscribe, the user's rows with a dead session are deleted
and only the newest 20 rows per user are kept (the current one always stays).

## What is sent

`PushNotifier.notify(event)` is called by routes after their work and never fails or delays them (errors are
logged). One event today, chosen for legacy parity: the only notifications the old site had were the header bell
(`new_notifications` of `GET /api/me`): votes of the people you follow made since you last opened the friends' feed.

- `friend-vote`: after `POST /api/me/votes` sets or changes a vote (not on removal), every follower of the voter
  (`user_friends.user_2 = voter`, `subscribed = 1`) gets
  `{title: <voter name>, body: '«<movie title>» — <Супер|Хорошо|Средне|Очень плохо>', url: '/movie/<id>', tag: 'friend-vote-<voter id>'}`.
  TTL 12 h, urgency `low`, topic `fv<voter id>`: a newer vote of the same friend replaces both the undelivered
  message at the push service and the notification shown on the device, so rating many films in a row gives one
  notification per friend, not a stream.

To add an event, extend `PushEvent` in `src/push/notifier.ts`, build its payload there and call `deps.push.notify()`
from the route. The service worker shows any `{title, body, url, tag?}` payload (`PushNotificationPayload` in
`@flicktips/shared`) and opens `url` (same-origin only) on click.

## Delivery

`WebPushSender` sends with VAPID (`aes128gcm`, 10 s timeout). The notifier sends to at most 8 subscriptions at a
time; a `404`/`410` from the push service (`PushSubscriptionGoneError`) deletes the row, other failures are logged
and the row stays. Delivery happens in the API process right after the vote; with many followers per user a queue
would be the next step.
