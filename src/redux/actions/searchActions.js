export const SEARCH_REQUEST_STARTED = 'SEARCH_REQUEST_STARTED';
export const SEARCH_REQUEST_FINISHED = 'SEARCH_REQUEST_FINISHED';
export const SEARCH_REQUEST_ERROR = 'SEARCH_REQUEST_ERROR';
export const SEARCH_REQUEST_CLEAR = 'SEARCH_REQUEST_CLEAR';

import api from 'api';
import isFunction from 'lodash/isFunction';

let request;

function searchRequestStarted() {
  return {type: SEARCH_REQUEST_STARTED};
}

function searchRequestFinished(response) {
  return {type: SEARCH_REQUEST_FINISHED, response};
}

function searchRequestError(errors) {
  return {type: SEARCH_REQUEST_ERROR, errors};
}

export function searchRequest(query, onSuccess, onError) {
  return (dispatch) => {
    dispatch(searchRequestStarted());

    if (request && isFunction(request.abort)) {
      request.abort();
    }

    request = api.search(query);

    return dispatch(request)
      .then((response) => {
        if (isFunction(onSuccess)) {
          onSuccess(response.body);
        }
        dispatch(searchRequestFinished(response.body));
      })
      .catch((err) => {
        if (isFunction(onError)) {
          onError(err);
        }
        dispatch(searchRequestError(err));
      });
  };
}

export function searchRequestClear() {
  return (dispatch) => {
    return dispatch({type: SEARCH_REQUEST_CLEAR});
  };
}