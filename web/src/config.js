const TMDB_POSTER_PATH = '//image.tmdb.org/t/p';
// SITE_URL comes from the environment on the server and from webpack DefinePlugin in the bundle
const SITE_URL = process.env.SITE_URL || 'https://flicktips.ru';

const config = {
  siteUrl: SITE_URL,
  apiUrl : SITE_URL + '/api',

  oAuth: {
    backend: {
      apiUrl: SITE_URL,
      authProviderPaths: {
        vkontakte: '/auth/vkontakte',
        yandex: '/auth/yandex'
      },
      tokenValidationPath: '/api/checkUser/',
      signOutPath: null
    },
    cookieOptions: {
      key: 'authHeaders',
      path: '/',
      expire: 30
    }
  },

  tmdb: {
    posterPath: TMDB_POSTER_PATH,
    posterPath92: TMDB_POSTER_PATH + '/w92',
    posterPath154: TMDB_POSTER_PATH + '/w154',
    posterPath185: TMDB_POSTER_PATH + '/w185',
    posterPath342: TMDB_POSTER_PATH + '/w342',
    posterPath500: TMDB_POSTER_PATH + '/w500',
    posterPath780: TMDB_POSTER_PATH + '/w780',
    posterPathOrg: TMDB_POSTER_PATH + '/original'
  }
};

export default config;