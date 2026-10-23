import { BOT_USERNAME, SITE_URL } from './env.js';

export interface User {
  id: number;
  username: string | null;
  gender: string | null;
  tg_user_id: string | null;
}

export interface Movie {
  id: number;
  title: string | null;
  original_title: string | null;
  release_date: string | null;
  first_air_date: string | null;
  tmdb_poster_path: string | null;
  kp_id: number | null;
}

// movie_vote.vote: 0 dislike, 1 neutral, 2 like, 3 super
// emoji closest to the site icons (web/src/components/Gui/VoteIcon.jsx), labels from web/src/helpers.js
const VOTES = ['💩 Очень плохо', '🩶 Средне', '❤️ Хорошо', '🔥 Супер'];

export function escapeHtml(text: string) {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function byGender(user: User, phrases: [string, string, string]) {
  if (user.gender === 'male') {
    return phrases[0];
  }
  if (user.gender === 'female') {
    return phrases[1];
  }
  return phrases[2];
}

export function userName(user: User) {
  return escapeHtml(user.username || 'Пользователь FlickTips');
}

function userLink(user: User) {
  return `<a href="${SITE_URL}/user/${user.id}">${userName(user)}</a>`;
}

export function movieUrl(movie: Movie) {
  return `${SITE_URL}/movie/${movie.id}`;
}

// Posters straight from TMDb: Telegram downloads them itself, from outside Russia
export function posterUrl(movie: Movie) {
  if (movie.tmdb_poster_path) {
    return 'https://image.tmdb.org/t/p/w500' + movie.tmdb_poster_path;
  }
  if (movie.kp_id) {
    return `${SITE_URL}/poster/kp/${movie.kp_id}.jpg`;
  }
  return null;
}

export function postText(user: User, movie: Movie, vote: number) {
  const title = escapeHtml(movie.title || movie.original_title || 'Без названия');
  const year = (movie.release_date || movie.first_air_date || '').slice(0, 4);

  return (
    `${userLink(user)} ${byGender(user, ['оценил', 'оценила', 'оценил(а)'])} ` +
    `<b>${title}</b>${year ? ` (${year})` : ''}\n${VOTES[vote]}`
  );
}

export function changedText(user: User, vote: number) {
  return `${userName(user)} ${byGender(user, ['передумал', 'передумала', 'передумал(а)'])}: ${VOTES[vote]}`;
}

export function welcomeText(members: string[]) {
  return (
    'Привет! Я буду публиковать сюда оценки фильмов с FlickTips.\n\n' +
    (members.length ? `Участвуют: ${members.map(escapeHtml).join(', ')}` : 'Пока никто не участвует.') +
    '\n\nЧтобы ваши оценки тоже появлялись здесь, нажмите «Участвовать».'
  );
}

export function botUrl(start?: string, group = false) {
  return `https://t.me/${BOT_USERNAME}` + (start !== undefined ? `?${group ? 'startgroup' : 'start'}=${start}` : '');
}
