import type { Paged, VoteName } from './common.js';
import type { BookmarkMovie, FriendsVoteMovie } from './movies.js';

export type LoginService = 'vkontakte' | 'yandex';

// UserRepository::$safety_fields: what other people may see of a user.
export interface PublicUser {
  id: number;
  username: string | null;
  avatar: string | null;
  gender: string | null;
  registration_date: string | null;
}

// GET /api/me (and PATCH /api/me) `data`: the signed-in user.
export interface ViewerProfile extends PublicUser {
  new_notifications: number;
  hide_viewed: boolean;
  // all the user's votes («248 оценок» in the sidebar)
  votes_count: number;
  // followers the user has not answered (the count next to «Друзья»)
  friend_requests: number;
}

export interface MeResponse {
  success: true;
  data: ViewerProfile;
}

// GET /api/users/:id: the follow flags are there only when a viewer looks at someone else.
export interface ProfileUser extends PublicUser {
  subscribed?: boolean;
  followsMe?: boolean;
}

export interface UserResponse {
  success: true;
  user: ProfileUser;
}

// GET /api/users/:id/stats (new in v2): the numbers in a profile header.
export interface ProfileStats {
  votes: Record<VoteName, number>;
  // mutual follows
  friends: number;
  // only on the viewer's own profile
  bookmarks?: number;
}

export interface ProfileStatsResponse {
  success: true;
  stats: ProfileStats;
}

// GET /api/me/circle (new in v2): one person on the friends page.
export interface CircleUser extends PublicUser {
  votes_count: number;
  last_vote: { movie_id: number; title: string | null; vote: number } | null;
  // 0–100, null with fewer than 3 common movies
  match: number | null;
  // people both follow
  common_friends: number;
}

export interface CircleResponse {
  success: true;
  // people who follow each other
  friends: CircleUser[];
  // followers the viewer has not answered
  requests: CircleUser[];
  // follows not returned yet
  outgoing: CircleUser[];
}

// POST /api/me/requests/decline
export interface DeclineRequestResponse {
  success: true;
  userId: number;
}

// GET /api/me/friends, GET /api/users/search
export interface ListedUser extends PublicUser {
  subscribed: boolean;
}

export type FriendsType = 'following' | 'followers';

// GET /api/users/search: `follows_me` and the counts for the search's «Возможные друзья»
export interface SearchedUser extends ListedUser {
  follows_me: boolean;
  votes_count: number;
  common_friends: number;
}

export interface UsersSearchResponse {
  success: true;
  results: SearchedUser[];
}

// GET /api/me/recommendations
export interface RecommendedUser extends PublicUser {
  reason: 'friends' | 'votes' | 'random';
  reason_count: number;
  subscribed: false;
}

export interface RecommendationsResponse {
  success: true;
  results: RecommendedUser[];
}

// GET /api/me/friends/votes: one entry per (friend, movie)
export interface FriendsVote {
  vote: number;
  timestamp: number;
  isNew: boolean;
  group_id: string;
  movie: FriendsVoteMovie;
  user: { id: number; name: string | null; avatar: string | null; gender: string | null };
}

export interface FriendsVotesResponse {
  success: true;
  results: Paged<FriendsVote>;
}

export interface BookmarksResponse {
  success: true;
  results: Paged<BookmarkMovie>;
}

// POST /api/me/subscriptions
export interface SubscribeResponse {
  success: true;
  userId: number;
  subscribed: boolean;
}

// GET /api/me/invite
export interface InviteCodeResponse {
  success: true;
  code: string;
}

// GET /api/invites/:code
export interface InviteResponse {
  success: true;
  user: PublicUser;
}

// POST /api/me/invite/accept
export interface AcceptInviteResponse {
  success: true;
  inviterId: number;
}

export type LoginServices = Record<LoginService, boolean>;

// GET /api/me/accounts
export interface AccountsResponse {
  success: true;
  services: LoginServices;
}

// What merging another account would move over (getMergeSummary).
export interface MergeSummary {
  user: PublicUser | null;
  votes: number;
  bookmarks: number;
  following: number;
  conflicts: number;
  blocking: LoginService[];
}

// POST /api/me/accounts/link
export type LinkAccountResponse =
  | { success: true; status: 'linked'; service: LoginService; services: LoginServices }
  | { success: true; status: 'conflict'; service: LoginService; merge: MergeSummary };

// POST /api/me/accounts/merge
export interface MergeAccountResponse {
  success: true;
  status: 'merged';
  service: LoginService;
  services: LoginServices;
}

// POST /api/me/accounts/unlink
export interface UnlinkAccountResponse {
  success: true;
  services: LoginServices;
}
