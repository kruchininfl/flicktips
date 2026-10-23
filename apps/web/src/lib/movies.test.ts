import { describe, expect, it } from 'vitest';

import { safeNext, signInPageUrl, signInUrl } from '@/viewer/urls';

import { getLastVoteTime, getPosterUrl } from './movies';

describe('getPosterUrl', () => {
  it('prefers the Кинопоиск poster through nginx, with the TMDb fallback path', () => {
    expect(getPosterUrl({ kp_id: '41519', tmdb_poster_path: '/a.jpg' })).toBe('/poster/kp/41519.jpg?tmdb=/a.jpg');
    expect(getPosterUrl({ kp_id: 41519, tmdb_poster_path: null }, true)).toBe(
      'https://flicktips.ru/poster/kp/41519.jpg',
    );
    expect(getPosterUrl({ kp_id: null, tmdb_poster_path: '/a.jpg' })).toBe('https://image.tmdb.org/t/p/w342/a.jpg');
    expect(getPosterUrl({ kp_id: null, tmdb_poster_path: null })).toBeNull();
  });
});

describe('getLastVoteTime', () => {
  it('takes the own vote time, else the latest listed vote', () => {
    expect(getLastVoteTime({ timestamp: '1700000000' })).toBe(1700000000);
    const vote = (timestamp: number) => ({ timestamp, value: 2, user_id: 1, user_name: null, user_avatar: null });
    expect(getLastVoteTime({ votes: [vote(5), vote(9), vote(7)] })).toBe(9);
    expect(getLastVoteTime({})).toBe(0);
  });
});

describe('sign-in URLs', () => {
  it('keeps `next` on this site', () => {
    expect(safeNext('/movie/1?x=2')).toBe('/movie/1?x=2');
    expect(safeNext('//evil.example')).toBe('/');
    expect(safeNext('https://evil.example')).toBe('/');
    expect(signInUrl('yandex', '/profile/friends/')).toBe('/auth/yandex?next=%2Fprofile%2Ffriends%2F');
    expect(signInUrl('vkontakte', '/profile/accounts/', true)).toBe(
      '/auth/vkontakte?next=%2Fprofile%2Faccounts%2F&link=1',
    );
    expect(signInPageUrl('/profile/bookmarks/')).toBe('/signin?next=%2Fprofile%2Fbookmarks%2F');
  });
});
