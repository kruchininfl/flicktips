import type { Paged } from './common.js';
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

// GET /api/me/friends, GET /api/users/search
export interface ListedUser extends PublicUser {
  subscribed: boolean;
}

export type FriendsType = 'following' | 'followers';

export interface UsersSearchResponse {
  success: true;
  results: ListedUser[];
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
