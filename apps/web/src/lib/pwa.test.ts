import { describe, expect, it } from 'vitest';

import { base64UrlToBytes, isNetworkOnlyPath, isSharedCacheable, notificationTarget, parsePushPayload } from './pwa';

describe('isNetworkOnlyPath', () => {
  it('keeps the API, OAuth and the worker itself out of the caches', () => {
    for (const path of [
      '/api',
      '/api/me',
      '/api/events',
      '/auth/vkontakte',
      '/auth/yandex/callback',
      '/serwist/sw.js',
    ]) {
      expect(isNetworkOnlyPath(path)).toBe(true);
    }
    for (const path of ['/', '/movie/1', '/profile/friends/', '/apiary', '/authors', '/public/favicon.ico']) {
      expect(isNetworkOnlyPath(path)).toBe(false);
    }
  });
});

describe('isSharedCacheable', () => {
  it('stores only explicitly public responses', () => {
    expect(isSharedCacheable(200, 'private, no-cache, no-store, max-age=0, must-revalidate')).toBe(false);
    expect(isSharedCacheable(200, 'no-store')).toBe(false);
    expect(isSharedCacheable(200, null)).toBe(false);
    expect(isSharedCacheable(200, 'max-age=60')).toBe(false);
    expect(isSharedCacheable(200, 's-maxage=0')).toBe(false);
    expect(isSharedCacheable(200, 'public, max-age=3600')).toBe(true);
    expect(isSharedCacheable(200, 's-maxage=31536000, stale-while-revalidate')).toBe(true);
    expect(isSharedCacheable(200, 'public, max-age=3600', true)).toBe(false);
    expect(isSharedCacheable(404, 'public, max-age=3600')).toBe(false);
  });
});

describe('parsePushPayload', () => {
  it('reads the API payload and falls back to a generic notification', () => {
    expect(
      parsePushPayload('{"title":"Аня","body":"«Сталкер» — Супер","url":"/movie/1","tag":"friend-vote-2"}'),
    ).toEqual({ title: 'Аня', body: '«Сталкер» — Супер', url: '/movie/1', tag: 'friend-vote-2' });
    const fallback = { title: 'FlickTips', body: 'Новые оценки друзей', url: '/' };
    expect(parsePushPayload(null)).toEqual(fallback);
    expect(parsePushPayload('not json')).toEqual(fallback);
    expect(parsePushPayload('{"body":"no title"}')).toEqual(fallback);
    expect(parsePushPayload('{"title":"x"}')).toEqual({ title: 'x', body: '', url: '/' });
  });
});

describe('notificationTarget', () => {
  it('opens paths of this site only', () => {
    const origin = 'https://flicktips.ru';
    expect(notificationTarget('/movie/1', origin)).toBe('https://flicktips.ru/movie/1');
    expect(notificationTarget('https://flicktips.ru/user/2', origin)).toBe('https://flicktips.ru/user/2');
    expect(notificationTarget('https://evil.example/', origin)).toBe('https://flicktips.ru/');
    expect(notificationTarget('//evil.example/x', origin)).toBe('https://flicktips.ru/');
    expect(notificationTarget('javascript:alert(1)', origin)).toBe('https://flicktips.ru/');
  });
});

describe('base64UrlToBytes', () => {
  it('decodes unpadded base64url', () => {
    expect([...base64UrlToBytes('-_8')]).toEqual([0xfb, 0xff]);
    expect([...base64UrlToBytes('AQID')]).toEqual([1, 2, 3]);
  });
});
