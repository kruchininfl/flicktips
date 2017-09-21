export const LAST_GRADED_LOADING_START = 'TRENDS_LOADING_START';
export const LAST_GRADED_LOADING_FINISH = 'TRENDS_LOADING_FINISH';
export const LAST_GRADED_LOADING_ERROR = 'TRENDS_LOADING_ERROR';
export const LAST_GRADED_ADD_START = 'TRENDS_ADD_START';
export const LAST_GRADED_ADD_FINISH = 'TRENDS_ADD_FINISH';

import api from 'api';

function startRequest() {
  return {type: LAST_GRADED_LOADING_START};
}

function finishRequest(response, onlyFriends) {
  return {type: LAST_GRADED_LOADING_FINISH, response, onlyFriends};
}

function errorRequest(err) {
  return {type: LAST_GRADED_LOADING_ERROR, err};
}

function addStart() {
  return {type: LAST_GRADED_ADD_START};
}

function addFinish(response) {
  return {type: LAST_GRADED_ADD_FINISH, response};
}

export function getLastGraded(page = 1, onlyFriends = false) {
  return (dispatch) => {
    dispatch(startRequest());

    return dispatch(api.getLastGraded(page, onlyFriends))
      .then((response) => dispatch(finishRequest(response.body, onlyFriends)))
      .catch((err) => dispatch(errorRequest(err)));
  };
}

export function addLastGraded(page = 1, onlyFriends = false) {
  return (dispatch) => {
    dispatch(addStart());

    dispatch(api.getLastGraded(page, onlyFriends))
      .then((response) => dispatch(addFinish(response.body)));
  };
}