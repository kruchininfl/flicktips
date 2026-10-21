import moment from 'moment';
import 'moment/locale/ru';
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
// When the movie was last voted on: the profile's own vote (movie.timestamp) or the latest of the listed votes
export function getLastVoteTime(movie) {
  const times = (movie.votes || []).map((v) => v.timestamp || 0);

  return movie.timestamp || (times.length ? Math.max(...times) : 0);
}

// "сегодня в 14:32", "вчера в 09:05", "12 окт в 21:10", with the year once it's not the current one
export function formatVoteTime(timestamp) {
  if (!timestamp) {
    return '';
  }

  const time = moment(timestamp * 1000);
  const now = moment();

  if (time.isSame(now, 'day')) {
    return time.format('[сегодня в] HH:mm');
  }
  if (time.isSame(now.clone().subtract(1, 'day'), 'day')) {
    return time.format('[вчера в] HH:mm');
  }

  return time.format(time.isSame(now, 'year') ? 'D MMM [в] HH:mm' : 'D MMM YYYY [в] HH:mm');
}