import { describe, expect, it } from 'vitest';

import {
  formatCardTime,
  formatDuration,
  formatHoursMinutes,
  formatLongDate,
  formatShortDate,
  formatVoteTime,
  timeAgo,
  yearOf,
} from './dates';

// 2026-10-23 12:00 MSK
const NOW = Date.UTC(2026, 9, 23, 9, 0);
const seconds = (ms: number) => Math.floor(ms / 1000);

describe('formatVoteTime', () => {
  it('names today and yesterday in Moscow time', () => {
    expect(formatVoteTime(seconds(Date.UTC(2026, 9, 23, 6, 5)), NOW)).toBe('сегодня в 09:05');
    // 23:30 MSK the day before, 20:30 UTC
    expect(formatVoteTime(seconds(Date.UTC(2026, 9, 22, 20, 30)), NOW)).toBe('вчера в 23:30');
    // 00:10 MSK today is still 21:10 UTC yesterday
    expect(formatVoteTime(seconds(Date.UTC(2026, 9, 22, 21, 10)), NOW)).toBe('сегодня в 00:10');
  });

  it('uses moment ru short months and adds the year when it differs', () => {
    expect(formatVoteTime(seconds(Date.UTC(2026, 4, 3, 18, 10)), NOW)).toBe('3 мая в 21:10');
    expect(formatVoteTime(seconds(Date.UTC(2025, 1, 12, 9, 0)), NOW)).toBe('12 февр. 2025 в 12:00');
  });

  it('is empty without a timestamp', () => {
    expect(formatVoteTime(0, NOW)).toBe('');
  });
});

describe('formatCardTime', () => {
  it('writes the card label of a vote', () => {
    expect(formatCardTime(seconds(Date.UTC(2026, 9, 23, 6, 5)), NOW)).toBe('сегодня, 09:05');
    expect(formatCardTime(seconds(Date.UTC(2026, 9, 22, 15, 5)), NOW)).toBe('вчера, 18:05');
    expect(formatCardTime(seconds(Date.UTC(2026, 9, 18, 19, 31)), NOW)).toBe('18 окт, 22:31');
    expect(formatCardTime(seconds(Date.UTC(2025, 4, 3, 18, 10)), NOW)).toBe('3 мая 2025');
    expect(formatCardTime(seconds(Date.UTC(2026, 9, 23, 6, 5)), NOW, true)).toBe('09:05');
    expect(formatCardTime(0, NOW)).toBe('');
  });
});

describe('formatHoursMinutes', () => {
  it('writes a running time', () => {
    expect(formatHoursMinutes(166)).toBe('2 ч 46 мин');
    expect(formatHoursMinutes(46)).toBe('46 мин');
    expect(formatHoursMinutes(120)).toBe('2 ч');
  });
});

describe('timeAgo', () => {
  it('follows the moment thresholds and plurals', () => {
    expect(timeAgo(NOW - 30_000, NOW)).toBe('несколько секунд назад');
    expect(timeAgo(NOW - 60_000, NOW)).toBe('минуту назад');
    expect(timeAgo(NOW - 5 * 60_000, NOW)).toBe('5 минут назад');
    expect(timeAgo(NOW - 22 * 60_000, NOW)).toBe('22 минуты назад');
    expect(timeAgo(NOW - 3 * 3_600_000, NOW)).toBe('3 часа назад');
    expect(timeAgo(NOW - 21 * 86_400_000, NOW)).toBe('21 день назад');
    expect(timeAgo(NOW - 40 * 86_400_000, NOW)).toBe('месяц назад');
    expect(timeAgo(NOW - 5 * 365 * 86_400_000, NOW)).toBe('5 лет назад');
  });
});

describe('dates', () => {
  it('formats like the legacy moment calls', () => {
    expect(yearOf('1997-12-12')).toBe('1997');
    expect(yearOf('2020')).toBe('2020');
    expect(yearOf('0000-00-00')).toBe('');
    expect(yearOf(null)).toBe('');
    expect(formatShortDate(Date.UTC(2026, 0, 5, 12))).toBe('05.01.26');
    expect(formatLongDate(Date.UTC(2020, 9, 12, 12))).toBe('12 октября 2020 г.');
    expect(formatDuration(95)).toBe('01:35');
  });
});
