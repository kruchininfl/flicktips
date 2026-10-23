// Spaces calls at least 1000 / perSecond ms apart. KinopoiskClient already caps requests in flight and
// retries 429/5xx; this caps the rate, which is what the API quota counts.
export function rateLimiter(perSecond: number, now = () => Date.now()) {
  const interval = perSecond > 0 ? 1000 / perSecond : 0;
  let next = 0;
  return async function wait(): Promise<void> {
    const t = now();
    const at = Math.max(t, next);
    next = at + interval;
    if (at > t) await new Promise((resolve) => setTimeout(resolve, at - t));
  };
}
