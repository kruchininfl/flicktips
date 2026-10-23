// Every API call the site makes, typed. One definition serves both transports: `serverApi` (api/server.ts, Server
// Components) and `api` (api/browser.ts, Client Components). Routes: apps/api/docs/routes-*.md and auth.md.
import type {
  AcceptInviteResponse,
  AccountsResponse,
  BookmarksResponse,
  DigitalResponse,
  FeedResponse,
  FilmResponse,
  FilmVotesResponse,
  FriendsType,
  FriendsVotesResponse,
  InviteCodeResponse,
  InviteResponse,
  LinkAccountResponse,
  LoginService,
  MeResponse,
  MergeAccountResponse,
  PagedResponse,
  PersonResponse,
  RecommendationsResponse,
  SearchResponse,
  SitemapIndexResponse,
  SitemapMoviesResponse,
  SitemapPeopleResponse,
  SubscribeResponse,
  TelegramConfirmResponse,
  TelegramLinkResponse,
  TelegramResponse,
  ToggleBookmarkResponse,
  ToggleVoteResponse,
  TrendsResponse,
  UnlinkAccountResponse,
  UserResponse,
  UsersSearchResponse,
  UserVotesResponse,
  ListedUser,
  VoteName,
} from '@flicktips/shared';

import type { Transport } from './core';

const id = (value: number | string) => encodeURIComponent(String(value));

// GET /api/events, the viewer's server-sent event stream (apps/api/docs/events.md). EventSource cannot go
// through a Transport, so components/shell/LiveUpdates opens this URL itself.
export const EVENTS_PATH = '/api/events';

export function createApi(fetchJson: Transport) {
  return {
    feed: {
      // page N returns the first N pages at once (the home page appends by re-requesting)
      lastGraded: (page = 1) => fetchJson<FeedResponse>('/api/feed/last-graded', { query: { page } }),
      friends: (page = 1) => fetchJson<FeedResponse>('/api/feed/friends', { query: { page } }),
    },
    movies: {
      get: (movieId: number | string) => fetchJson<FilmResponse>(`/api/movies/${id(movieId)}`),
      votes: (movieId: number | string) => fetchJson<FilmVotesResponse>(`/api/movies/${id(movieId)}/votes`),
      search: (query: string) =>
        fetchJson<SearchResponse>('/api/movies/search', { query: { query }, signInOn401: false }),
      trends: () => fetchJson<TrendsResponse>('/api/movies/trends', { signInOn401: false }),
      digital: (query: { page?: number; [filter: string]: string | number | undefined } = {}) =>
        fetchJson<DigitalResponse>('/api/movies/digital', { query }),
    },
    people: {
      get: (personId: number | string) => fetchJson<PersonResponse>(`/api/people/${id(personId)}`),
    },
    users: {
      get: (userId: number | string) => fetchJson<UserResponse>(`/api/users/${id(userId)}`),
      // `me` for the signed-in viewer
      votes: (userId: number | string | 'me', { page = 1, size }: { page?: number; size?: number } = {}) =>
        fetchJson<UserVotesResponse>(`/api/users/${id(userId)}/votes`, { query: { page, size } }),
      search: (q: string) => fetchJson<UsersSearchResponse>('/api/users/search', { query: { q }, signInOn401: false }),
    },
    invites: {
      get: (code: string) => fetchJson<InviteResponse>(`/api/invites/${id(code)}`),
    },
    me: {
      // 401 for anonymous viewers; use getViewer() (viewer/server.ts) on the server
      get: () => fetchJson<MeResponse>('/api/me', { signInOn401: false }),
      update: (data: { hide_viewed?: boolean | 0 | 1 }) =>
        fetchJson<MeResponse>('/api/me', { method: 'PATCH', body: { data } }),
      friends: ({ page = 1, size, type = 'following' }: { page?: number; size?: number; type?: FriendsType } = {}) =>
        fetchJson<PagedResponse<ListedUser>>('/api/me/friends', { query: { page, size, type } }),
      friendsVotes: (page = 1) =>
        fetchJson<FriendsVotesResponse>('/api/me/friends/votes', { query: { page }, signInOn401: false }),
      bookmarks: ({ page = 1, size }: { page?: number; size?: number } = {}) =>
        fetchJson<BookmarksResponse>('/api/me/bookmarks', { query: { page, size } }),
      // sets the vote, or removes it when the same vote is sent again
      vote: (movieId: number, vote: VoteName) =>
        fetchJson<ToggleVoteResponse>('/api/me/votes', { method: 'POST', body: { id: movieId, vote } }),
      toggleBookmark: (movieId: number) =>
        fetchJson<ToggleBookmarkResponse>('/api/me/bookmarks/toggle', { method: 'POST', body: { movieId } }),
      subscribe: (userId: number, subscribed: boolean) =>
        fetchJson<SubscribeResponse>('/api/me/subscriptions', { method: 'POST', body: { userId, subscribed } }),
      invite: () => fetchJson<InviteCodeResponse>('/api/me/invite'),
      acceptInvite: (code: string) =>
        fetchJson<AcceptInviteResponse>('/api/me/invite/accept', {
          method: 'POST',
          body: { code },
          signInOn401: false,
        }),
      recommendations: () => fetchJson<RecommendationsResponse>('/api/me/recommendations'),
      accounts: () => fetchJson<AccountsResponse>('/api/me/accounts'),
      linkAccount: (proof: string) =>
        fetchJson<LinkAccountResponse>('/api/me/accounts/link', { method: 'POST', body: { proof } }),
      mergeAccount: (proof: string) =>
        fetchJson<MergeAccountResponse>('/api/me/accounts/merge', { method: 'POST', body: { proof } }),
      unlinkAccount: (service: LoginService) =>
        fetchJson<UnlinkAccountResponse>('/api/me/accounts/unlink', { method: 'POST', body: { service } }),
      telegram: {
        get: () => fetchJson<TelegramResponse>('/api/me/telegram'),
        // a fresh one-time code with the t.me links for linking Telegram and adding the bot to a group
        link: () => fetchJson<TelegramLinkResponse>('/api/me/telegram/link', { method: 'POST' }),
        confirm: (code: string) =>
          fetchJson<TelegramConfirmResponse>('/api/me/telegram/confirm', {
            method: 'POST',
            body: { code },
            signInOn401: false,
          }),
        leaveGroup: (chatId: string) =>
          fetchJson<{ success: true }>(`/api/me/telegram/groups/${id(chatId)}`, { method: 'DELETE' }),
        unlink: () => fetchJson<{ success: true }>('/api/me/telegram', { method: 'DELETE' }),
      },
    },
    // ids for /sitemaps/*.xml (app/sitemaps); use publicServerApi, these are the same for every visitor
    sitemap: {
      index: () => fetchJson<SitemapIndexResponse>('/api/sitemap'),
      movies: (chunk: number) => fetchJson<SitemapMoviesResponse>(`/api/sitemap/movies/${id(chunk)}`),
      people: (chunk: number) => fetchJson<SitemapPeopleResponse>(`/api/sitemap/people/${id(chunk)}`),
    },
    auth: {
      logout: () => fetchJson<{ success: true }>('/api/auth/logout', { method: 'POST', signInOn401: false }),
      logoutAll: () => fetchJson<{ success: true }>('/api/auth/logout-all', { method: 'POST' }),
    },
  };
}

export type Api = ReturnType<typeof createApi>;
