import type { Paged } from './common.js';

export interface Genre {
  id: number;
  name: string;
}

export interface Country {
  id: number;
  name: string;
}

export interface VoteCounters {
  super: number;
  likes: number;
  neutral: number;
  dislikes: number;
}

// The viewer's vote and bookmark on a movie. Missing for anonymous viewers on some routes, `false` on others
// (docs/routes-movies.md, "Response shapes").
export interface ViewerFlags {
  isSuper?: boolean;
  isLiked?: boolean;
  isNeutral?: boolean;
  isDisliked?: boolean;
  inBookmarks?: boolean;
}

// A vote in a movie's `votes` list (feeds, search, the film page, the person page), newest first.
export interface MovieVote {
  timestamp: number;
  value: number;
  user_id: number;
  user_name: string | null;
  user_avatar: string | null;
}

// A friend's vote in a `friend_votes` list (trends, a user's votes, bookmarks): other key names than MovieVote.
export interface FriendVote {
  user_id: number;
  user_name: string | null;
  user_avatar: string | null;
  vote: number;
  vote_timestamp: number;
}

// What every movie object carries; the movie card (components/movie/MoviePreview) needs only this.
export interface MovieBase extends VoteCounters, ViewerFlags {
  id: number;
  type: string | null; // 'movie' | 'tv'
  title: string | null;
  original_title: string | null;
  tmdb_poster_path: string | null;
  kp_id: number | string | null; // int in `movie_*` rows, PDO string in `movie.*` rows
  release_date: string | null;
  first_air_date: string | null;
  tmdb_overview: string | null;
  original_language: string | null;
  tmdb_popularity: number | null;
  kp_rating_value?: number | null;
  imdb_rating_value?: number | null;
  // Кинопоиск overview, else the TMDB one
  overview?: string | null;
  genres?: Genre[];
  votes?: MovieVote[];
  friend_votes?: FriendVote[];
}

// A full `movie.*` row (trends, search, digital, a user's votes, the film page, bookmarks).
export interface MovieRow extends MovieBase {
  tmdb_id: string | null;
  tmdb_trailers: string | string[] | null;
  kp_id: string | null;
  kp_title: string | null;
  kp_original_title: string | null;
  kp_start_year: string | null;
  kp_finish_year: string | null;
  kp_overview: string | null;
  kp_duration: string | null;
  kp_release_date: string | null;
  kp_release_date_dvd: string | null;
  kp_release_date_rus: string | null;
  kp_rating_value: number;
  kp_rating_count: number;
  imdb_id: string | null;
  imdb_rating_value: number;
  imdb_rating_count: number;
  kp_title_similarity: string | null;
  kp_force_check: string;
  suspend: string;
}

// GET /api/feed/last-graded, /api/feed/friends: `movie_*` columns with all (or the friends') votes.
export interface FeedMovie extends MovieBase {
  kp_id: number | null;
  kp_rating_value: number;
  imdb_rating_value: number;
}

export interface FeedResponse {
  success: true;
  results: Paged<FeedMovie>;
}

// GET /api/movies/search, /api/movies/digital: friends' votes come as `votes`.
export interface SearchResponse {
  total: number;
  results: MovieRow[];
}

export interface DigitalResponse {
  success: true;
  results: Paged<MovieRow>;
}

// GET /api/movies/trends: friends' votes come as `friend_votes`.
export interface TrendsResponse {
  success: true;
  results: { total: number; entities: MovieRow[] };
}

// GET /api/users/:id/votes: the user's own vote and when it was cast (a PDO string, unix seconds).
export interface UserVoteMovie extends MovieRow {
  vote: number;
  timestamp: string;
}

export interface UserVotesResponse {
  success: true;
  results: Paged<UserVoteMovie>;
}

export interface StaffPerson {
  id: number;
  name: string | null;
  original_name: string | null;
  photo: string | null;
  description: string | null;
}

export interface StaffGroup {
  type: string | null;
  title: string | null;
  people: StaffPerson[];
}

// GET /api/movies/:id
export interface FilmDetails extends Omit<MovieRow, 'tmdb_trailers'> {
  // ["YouTube:<key>", …]
  tmdb_trailers: string[];
  countries?: Country[];
  staff?: StaffGroup[];
}

export interface FilmResponse {
  success: true;
  movie: FilmDetails;
}

// GET /api/movies/:id/votes
export interface FilmVote {
  id: number;
  vote: number;
  timestamp: string; // 'YYYY-MM-DD HH:MM:SS'
  user_id: number;
  user: { id: number; avatar: string; gender: string; username: string; isFriend: boolean };
}

export interface FilmVotesResponse {
  success: true;
  movie_id: number;
  votes: FilmVote[];
}

// GET /api/me/bookmarks entities
export interface BookmarkMovie extends MovieRow {
  inBookmarks: true;
}

// `movie` of a GET /api/me/friends/votes entry
export interface FriendsVoteMovie extends Omit<MovieBase, 'type'> {
  kp_id: number | null;
  kp_overview: string | null;
}

// POST /api/me/votes `data`: the movie's new counters and the viewer's vote
export interface ToggleVoteResult extends VoteCounters {
  id: number;
  isSuper: boolean;
  isLiked: boolean;
  isNeutral: boolean;
  isDisliked: boolean;
}

export interface ToggleVoteResponse {
  success: true;
  data: ToggleVoteResult;
}

// POST /api/me/bookmarks/toggle
export interface ToggleBookmarkResponse {
  success: true;
  data: { movie_id: number; inBookmarks: boolean };
}
