export const MOVIE_LOADING_START = 'MOVIE_LOADING_START';
export const MOVIE_LOADING_FINISH = 'MOVIE_LOADING_FINISH';
export const MOVIE_LOADING_ERROR = 'MOVIE_LOADING_ERROR';

export const MOVIE_VOTES_LOADING_START = 'MOVIE_VOTES_LOADING_START';
export const MOVIE_VOTES_LOADING_FINISH = 'MOVIE_VOTES_LOADING_FINISH';
export const MOVIE_VOTES_LOADING_ERROR = 'MOVIE_VOTES_LOADING_ERROR';

import api from 'api';

function startRequest() {
  return {type: MOVIE_LOADING_START};
}

function finishRequest(response) {
  return {type: MOVIE_LOADING_FINISH, response};
}

function errorRequest(err) {
  return {type: MOVIE_LOADING_ERROR, err};
}

function startVotesRequest() {
  return {type: MOVIE_VOTES_LOADING_START};
}

function finishVotesRequest(response) {
  return {type: MOVIE_VOTES_LOADING_FINISH, response};
}

function errorVotesRequest(err) {
  return {type: MOVIE_VOTES_LOADING_ERROR, err};
}

export function getFilm(id) {
  return (dispatch) => {
    dispatch(startRequest());

    return dispatch(api.getMovie(id))
      .then((response) => dispatch(finishRequest(response.body)))
      .catch((err) => dispatch(errorRequest(err)));
  };
}

export function getFilmVotes(id) {
  return (dispatch) => {
    dispatch(startVotesRequest());

    return dispatch(api.getMovieVotes(id))
      .then((response) => dispatch(finishVotesRequest(response.body)))
      .catch((err) => dispatch(errorVotesRequest(err)));
  };
}