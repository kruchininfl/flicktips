export const MOVIE_LOADING_START = 'MOVIE_LOADING_START';
export const MOVIE_LOADING_FINISH = 'MOVIE_LOADING_FINISH';
export const MOVIE_LOADING_ERROR = 'MOVIE_LOADING_ERROR';

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

export function getFilm(id) {
  return (dispatch) => {
    dispatch(startRequest());

    return dispatch(api.getMovie(id))
      .then((response) => dispatch(finishRequest(response.body)))
      .catch((err) => dispatch(errorRequest(err)));
  };
}