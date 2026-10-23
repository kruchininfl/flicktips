import { describe, expect, it } from 'vitest';

import { botUrl, changedText, escapeHtml, movieUrl, posterUrl, postText, userName, welcomeText } from './texts.js';
import type { Movie, User } from './texts.js';

const user: User = { id: 7, username: 'Ann <b>', gender: 'female', tg_user_id: '100' };
const movie: Movie = {
  id: 42,
  title: 'Alien & Co',
  original_title: null,
  release_date: '1979-05-25',
  first_air_date: null,
  tmdb_poster_path: '/p.jpg',
  kp_id: 5,
};

describe('texts', () => {
  it('escapes HTML', () => {
    expect(escapeHtml('<a href="x">&</a>')).toBe('&lt;a href="x"&gt;&amp;&lt;/a&gt;');
    expect(userName({ ...user, username: null })).toBe('Пользователь FlickTips');
  });

  it('builds a post with gender, escaped names, year and vote label', () => {
    expect(postText(user, movie, 3)).toBe(
      '<a href="https://flicktips.ru/user/7">Ann &lt;b&gt;</a> оценила <b>Alien &amp; Co</b> (1979)\n🔥 Супер',
    );
    expect(postText({ ...user, gender: 'male' }, { ...movie, release_date: null }, 0)).toContain(' оценил <b>');
    expect(postText({ ...user, gender: null }, movie, 1)).toContain(' оценил(а) ');
  });

  it('builds the changed-rating reply', () => {
    expect(changedText(user, 2)).toBe('Ann &lt;b&gt; передумала: ❤️ Хорошо');
  });

  it('prefers the TMDb poster and falls back to the site poster', () => {
    expect(posterUrl(movie)).toBe('https://image.tmdb.org/t/p/w500/p.jpg');
    expect(posterUrl({ ...movie, tmdb_poster_path: null })).toBe('https://flicktips.ru/poster/kp/5.jpg');
    expect(posterUrl({ ...movie, tmdb_poster_path: null, kp_id: null })).toBeNull();
    expect(movieUrl(movie)).toBe('https://flicktips.ru/movie/42');
  });

  it('builds the welcome text and bot links', () => {
    expect(welcomeText([])).toContain('Пока никто не участвует.');
    expect(welcomeText(['a', 'b<'])).toContain('Участвуют: a, b&lt;');
    expect(botUrl()).toBe('https://t.me/FlickTipsBot');
    expect(botUrl('join_-1')).toBe('https://t.me/FlickTipsBot?start=join_-1');
    expect(botUrl('add', true)).toBe('https://t.me/FlickTipsBot?startgroup=add');
  });
});
