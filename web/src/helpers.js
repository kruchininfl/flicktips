import config from 'config';

export function pluralGender(gender, phrases) {
  if (gender === 'male') {
    return phrases[0];
  } else if (gender === 'female') {
    return phrases[1];
  }

  return phrases[2];
}

export function getTextByVoteId(id) {
  const icons = ['Очень плохо', 'Средне', 'Хорошо', 'Супер'];

  return icons[id];
}

export function getStringByVoteId(id) {
  const icons = ['dislike', 'neutral', 'like', 'super'];

  return icons[id];
}

export function getVoteIconClassById(id, filled = false) {
  const icons = ['dislike', 'neutral', 'like', 'super'];

  return `vote-icn vote-icn_${icons[id]} ${filled ? 'm-active' : ''}`;
}

// Posters come from Кинопоиск through our nginx (/poster/kp/<kp_id>.jpg, cached there): image.tmdb.org is often
// unreachable from Russia. The TMDb path goes along so nginx can redirect to it when Кинопоиск has no poster.
export function getPosterUrl(movie) {
  if (movie.kp_id) {
    return config.siteUrl + '/poster/kp/' + movie.kp_id + '.jpg' +
      (movie.tmdb_poster_path ? '?tmdb=' + movie.tmdb_poster_path : '');
  }

  return movie.tmdb_poster_path ? config.tmdb.posterPath342 + movie.tmdb_poster_path : null;
}