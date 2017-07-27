export const FEED_LOADING_START = 'FEED_LOADING_START';
export const FEED_LOADING_FINISH = 'FEED_LOADING_FINISH';
export const FEED_LOADING_ERROR = 'FEED_LOADING_ERROR';
export const FEED_ADD_VOTES_START = 'FEED_ADD_VOTES_START';
export const FEED_ADD_VOTES_FINISH = 'FEED_ADD_VOTES_FINISH';
export const FEED_RESET = 'FEED_RESET';

import api from 'api';

function startRequest() {
  return {type: FEED_LOADING_START};
}

function finishRequest(response) {
  return {type: FEED_LOADING_FINISH, response};
}

function errorRequest(err) {
  return {type: FEED_LOADING_ERROR, err};
}

function addVotesStart() {
  return {type: FEED_ADD_VOTES_START};
}

function addVotesFinish(response) {
  return {type: FEED_ADD_VOTES_FINISH, response};
}

export function getFriendsVotes() {
  return (dispatch) => {
    dispatch(startRequest());

    return dispatch(api.getFriendsVotes())
      .then((response) => dispatch(finishRequest(response.body)))
      .catch((err) => dispatch(errorRequest(err)));
  };
}

export function loadVotes(page) {
  return (dispatch) => {
    dispatch(addVotesStart());

    dispatch(api.getFriendsVotes(page))
      .then((response) => dispatch(addVotesFinish(response.body)));
  };
}

export function resetFeed() {
  return (dispatch) => dispatch({type: FEED_RESET});
}