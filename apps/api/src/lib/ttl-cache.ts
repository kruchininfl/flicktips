// A small in-process cache of async results: entries live `ttlMs`, at most `maxEntries` are kept (the oldest goes
// first), and concurrent callers of a missing key share one load. A failed load is not cached.
export class TtlCache<T> {
  private readonly entries = new Map<string, { expires: number; value: Promise<T> }>();

  constructor(
    private readonly ttlMs: number,
    private readonly maxEntries: number,
    private readonly now: () => number = Date.now,
  ) {}

  get(key: string, load: () => Promise<T>): Promise<T> {
    const hit = this.entries.get(key);
    if (hit && hit.expires > this.now()) return hit.value;
    if (hit) this.entries.delete(key);

    const value = load();
    this.entries.set(key, { expires: this.now() + this.ttlMs, value });
    value.catch(() => {
      if (this.entries.get(key)?.value === value) this.entries.delete(key);
    });
    while (this.entries.size > this.maxEntries) {
      const oldest = this.entries.keys().next().value as string;
      this.entries.delete(oldest);
    }
    return value;
  }

  clear(): void {
    this.entries.clear();
  }
}
