export const VOTE_REQUEST_STARTED = 'VOTE_REQUEST_STARTED';
export const VOTE_REQUEST_FINISHED = 'VOTE_REQUEST_FINISHED';
export const VOTE_REQUEST_ERROR = 'VOTE_REQUEST_ERROR';

import api from 'api';
import isFunction from 'lodash/isFunction';

let request;

function voteRequestStarted() {
  return {type: VOTE_REQUEST_STARTED};
}

function voteRequestFinished(response) {
  return {type: VOTE_REQUEST_FINISHED, response};
}

function voteRequestError(errors) {
  return {type: VOTE_REQUEST_ERROR, errors};
}

export function voteRequest(entityId, vote) {
  return (dispatch) => {
    dispatch(voteRequestStarted());

    if (request && isFunction(request.abort)) {
      request.abort();
    }

    request = api.toggleVote(entityId, vote);

    return dispatch(request)
      .then((response) => dispatch(voteRequestFinished(response.body)))
      .catch((err) => dispatch(voteRequestError(err)));
  };
}

export function voteUpdateCounters(data) {
  return (dispatch) => {
    return dispatch(voteRequestFinished(data));
  };
}