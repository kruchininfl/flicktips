import { describe, expect, it } from 'vitest';

import { trailersFromKp, youtubeKey } from './trailers.js';

describe('youtubeKey', () => {
  it('reads the URL forms Кинопоиск uses', () => {
    expect(youtubeKey('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
    expect(youtubeKey('http://www.youtube.com/v/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
    expect(youtubeKey('https://youtu.be/dQw4w9WgXcQ?t=3')).toBe('dQw4w9WgXcQ');
    expect(youtubeKey('https://www.youtube.com/embed/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
    expect(youtubeKey('https://widgets.kinopoisk.ru/discovery/trailer/123')).toBeNull();
    expect(youtubeKey('not a url')).toBeNull();
  });
});

describe('trailersFromKp', () => {
  it('keeps YouTube videos as "YouTube:<key>" without duplicates', () => {
    expect(
      trailersFromKp([
        { url: 'https://www.youtube.com/watch?v=aaaaaaaaaaa', name: 'Трейлер', site: 'YOUTUBE' },
        { url: 'https://widgets.kinopoisk.ru/discovery/trailer/1', name: 'KP', site: 'KINOPOISK_WIDGET' },
        { url: 'https://youtu.be/aaaaaaaaaaa', name: 'Again', site: 'YOUTUBE' },
        { url: 'https://youtu.be/bbbbbbbbbbb', name: 'Тизер', site: 'YOUTUBE' },
      ]),
    ).toEqual(['YouTube:aaaaaaaaaaa', 'YouTube:bbbbbbbbbbb']);
  });
});
