export const TRENDS_LOADING_START = 'TRENDS_LOADING_START';
export const TRENDS_LOADING_FINISH = 'TRENDS_LOADING_FINISH';
export const TRENDS_LOADING_ERROR = 'TRENDS_LOADING_ERROR';
export const TRENDS_ADD_START = 'TRENDS_ADD_START';
export const TRENDS_ADD_FINISH = 'TRENDS_ADD_FINISH';

import api from 'api';

function startRequest() {
  return {type: TRENDS_LOADING_START};
}

function finishRequest(response) {
  return {type: TRENDS_LOADING_FINISH, response};
}

function errorRequest(err) {
  return {type: TRENDS_LOADING_ERROR, err};
}

function addStart() {
  return {type: TRENDS_ADD_START};
}

function addFinish(response) {
  return {type: TRENDS_ADD_FINISH, response};
}

export function getTrends() {
  return (dispatch) => {
    dispatch(startRequest());

    return dispatch(api.getTrends())
      .then((response) => dispatch(finishRequest(response.body)))
      .catch((err) => dispatch(errorRequest(err)));
  };
}

export function addTrends(page) {
  return (dispatch) => {
    dispatch(addStart());

    dispatch(api.getTrends(page))
      .then((response) => dispatch(addFinish(response.body)));
  };
}