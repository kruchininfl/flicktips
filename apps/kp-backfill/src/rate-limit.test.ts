import { afterEach, describe, expect, it, vi } from 'vitest';

import { rateLimiter } from './rate-limit.js';

describe('rateLimiter', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('spaces calls 1000 / perSecond ms apart', async () => {
    vi.useFakeTimers();
    const wait = rateLimiter(4);
    const done: number[] = [];
    const start = Date.now();
    for (let i = 0; i < 3; i++) void wait().then(() => done.push(Date.now() - start));
    await vi.advanceTimersByTimeAsync(1000);
    expect(done).toEqual([0, 250, 500]);
  });
});
