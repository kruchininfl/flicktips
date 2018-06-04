export const PERSON_LOADING_START = 'PERSON_LOADING_START';
export const PERSON_LOADING_FINISH = 'PERSON_LOADING_FINISH';
export const PERSON_LOADING_ERROR = 'PERSON_LOADING_ERROR';

import api from 'api';

function startRequest() {
  return {type: PERSON_LOADING_START};
}

function finishRequest(response) {
  return {type: PERSON_LOADING_FINISH, response};
}

function errorRequest(err) {
  return {type: PERSON_LOADING_ERROR, err};
}

export function getPerson(id) {
  return (dispatch) => {
    dispatch(startRequest());

    return dispatch(api.getPerson(id))
      .then((response) => dispatch(finishRequest(response.body)))
      .catch((err) => dispatch(errorRequest(err)));
  };
}