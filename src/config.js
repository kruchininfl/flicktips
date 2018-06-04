const TMDB_POSTER_PATH = '//image.tmdb.org/t/p';

const config = {
  // apiUrl: 'http://dev.flick.tips:8888/api',
  apiUrl: 'https://flick.tips/api',

  vkAppUrl: 'https://vk.com/app6127205',

  oAuth: {
    backend: {
      apiUrl             : 'https://flick.tips',
      authProviderPaths  : {
        vkontakte: '/auth/vkontakte',
        facebook : '/auth/facebook'
      },
      tokenValidationPath: '/api/checkUser/',
      signOutPath        : null
    },
    cookieOptions: {
      key: 'authHeaders',
      path: '/',
      expire: 30
    }
  },

  tmdb: {
    posterPath   : TMDB_POSTER_PATH,
    posterPath92 : TMDB_POSTER_PATH + '/w92',
    posterPath154: TMDB_POSTER_PATH + '/w154',
    posterPath185: TMDB_POSTER_PATH + '/w185',
    posterPath342: TMDB_POSTER_PATH + '/w342',
    posterPath500: TMDB_POSTER_PATH + '/w500',
    posterPath780: TMDB_POSTER_PATH + '/w780',
    posterPathOrg: TMDB_POSTER_PATH + '/original'
  }
};

export default config;