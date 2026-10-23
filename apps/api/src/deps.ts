import type { Db } from '@flicktips/db';
import type { KinopoiskClient } from '@flicktips/kinopoisk';

import type { Config } from './config.js';

// Everything a route needs from the outside world; tests pass a throwaway DB and a fake Кинопоиск.
export interface AppDeps {
  db: Db;
  kp: Pick<KinopoiskClient, 'getFilm' | 'searchFilms' | 'getVideos' | 'getStaff' | 'getFilters'>;
  config: Pick<Config, 'env' | 'telegramBotUsername'>;
  // true when the database answers
  pingDb: () => Promise<boolean>;
}
