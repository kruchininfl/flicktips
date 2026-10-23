import type { KpFilm, KpFilmList, KpFilmType, KpFilters, KpStaff, KpVideos } from './types.js';

export class KinopoiskError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = 'KinopoiskError';
  }
}

export interface KinopoiskClientOptions {
  apiKey: string;
  baseUrl?: string;
  timeoutMs?: number;
  // requests in flight at once; the API allows about 5 per second on most endpoints
  concurrency?: number;
  // retries after 429 and 5xx, with growing pauses
  retries?: number;
  fetch?: typeof fetch;
}

export interface SearchFilmsParams {
  keyword?: string;
  yearFrom?: number;
  yearTo?: number;
  type?: 'ALL' | KpFilmType;
  order?: 'RATING' | 'NUM_VOTE' | 'YEAR';
  page?: number;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export class KinopoiskClient {
  private readonly baseUrl: string;
  private readonly timeoutMs: number;
  private readonly concurrency: number;
  private readonly retries: number;
  private readonly fetchFn: typeof fetch;
  private active = 0;
  private readonly waiting: (() => void)[] = [];

  constructor(private readonly options: KinopoiskClientOptions) {
    this.baseUrl = options.baseUrl ?? 'https://kinopoiskapiunofficial.tech';
    this.timeoutMs = options.timeoutMs ?? 10_000;
    this.concurrency = options.concurrency ?? 4;
    this.retries = options.retries ?? 3;
    this.fetchFn = options.fetch ?? fetch;
  }

  // null when Кинопоиск has no such film
  getFilm(id: number): Promise<KpFilm | null> {
    return this.get<KpFilm>(`/api/v2.2/films/${id}`, {}, true);
  }

  searchFilms(params: SearchFilmsParams): Promise<KpFilmList> {
    return this.get<KpFilmList>('/api/v2.2/films', {
      order: params.order ?? 'RATING',
      type: params.type ?? 'ALL',
      ratingFrom: 0,
      ratingTo: 10,
      yearFrom: params.yearFrom ?? 1000,
      yearTo: params.yearTo ?? 3000,
      page: params.page ?? 1,
      keyword: params.keyword,
    }) as Promise<KpFilmList>;
  }

  async getVideos(id: number): Promise<KpVideos> {
    return (await this.get<KpVideos>(`/api/v2.2/films/${id}/videos`, {}, true)) ?? { total: 0, items: [] };
  }

  async getStaff(filmId: number): Promise<KpStaff[]> {
    return (await this.get<KpStaff[]>('/api/v1/staff', { filmId }, true)) ?? [];
  }

  getFilters(): Promise<KpFilters> {
    return this.get<KpFilters>('/api/v2.2/films/filters') as Promise<KpFilters>;
  }

  private async get<T>(
    path: string,
    query: Record<string, string | number | undefined> = {},
    allowNotFound = false,
  ): Promise<T | null> {
    const url = new URL(path, this.baseUrl);
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined) url.searchParams.set(key, String(value));
    }

    await this.acquire();
    try {
      for (let attempt = 0; ; attempt++) {
        const res = await this.fetchFn(url, {
          headers: { 'X-API-KEY': this.options.apiKey, Accept: 'application/json' },
          signal: AbortSignal.timeout(this.timeoutMs),
        });
        if (res.ok) return (await res.json()) as T;
        if (res.status === 404 && allowNotFound) return null;
        const retryable = res.status === 429 || res.status >= 500;
        if (!retryable || attempt >= this.retries) {
          throw new KinopoiskError(`Kinopoisk ${res.status} for ${url.pathname}`, res.status);
        }
        await sleep(500 * 2 ** attempt);
      }
    } finally {
      this.release();
    }
  }

  private async acquire() {
    if (this.active < this.concurrency) {
      this.active++;
      return;
    }
    await new Promise<void>((resolve) => this.waiting.push(resolve));
  }

  private release() {
    const next = this.waiting.shift();
    if (next) next();
    else this.active--;
  }
}
