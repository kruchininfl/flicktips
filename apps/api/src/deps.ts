import type { Db } from '@flicktips/db';
import type { KinopoiskClient } from '@flicktips/kinopoisk';

import type { OAuthProviders } from './auth/oauth.js';
import type { Config } from './config.js';

// Everything a route needs from the outside world; tests pass a throwaway DB, a fake Кинопоиск and fake
// sign-in providers.
export interface AppDeps {
  db: Db;
  kp: Pick<KinopoiskClient, 'getFilm' | 'searchFilms' | 'getVideos' | 'getStaff' | 'getFilters'>;
  // VK ID and Yandex ID (src/auth/providers); tests use fakes that never touch the network
  oauth: OAuthProviders;
  config: Pick<Config, 'env' | 'telegramBotUsername' | 'siteUrl' | 'authSecret'>;
  // true when the database answers
  pingDb: () => Promise<boolean>;
}
