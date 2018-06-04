export const PROFILE_LOADING_START = 'PROFILE_LOADING_START';
export const PROFILE_LOADING_FINISH = 'PROFILE_LOADING_FINISH';
export const PROFILE_LOADING_ERROR = 'PROFILE_LOADING_ERROR';
export const PROFILE_ADD_VOTES_FINISH = 'PROFILE_ADD_VOTES_FINISH';
export const PROFILE_ADD_VOTES_START = 'PROFILE_ADD_VOTES_START';

import api from 'api';
import {isUserSignedIn, getUserModel} from 'redux/models/user';

function startRequest() {
  return {type: PROFILE_LOADING_START};
}

function finishRequest(response) {
  return {type: PROFILE_LOADING_FINISH, response};
}

function errorRequest(err) {
  return {type: PROFILE_LOADING_ERROR, err};
}

function addVotesStart() {
  return {type: PROFILE_ADD_VOTES_START};
}

function addVotesFinish(response) {
  return {type: PROFILE_ADD_VOTES_FINISH, response};
}

export function getProfile(userId) {
  return (dispatch, getState) => {
    dispatch(startRequest());

    const state = getState();
    const isMyPage = isUserSignedIn(state) && userId === getUserModel(state).get('id');
    const promiseVotes = dispatch(api.getUserVotes(userId));
    const promiseUser = dispatch(api.getUser(userId));

    return Promise.all([promiseVotes, promiseUser])
      .then((responses) => {
        const [votes, user] = [responses[0].body, responses[1].body];

        if (!votes.success) {
          return dispatch(errorRequest(votes.err));
        }

        if (!user.success) {
          return dispatch(errorRequest(user.err));
        }

        dispatch(finishRequest({user: user.user, votes: votes.results, isMyPage}));
      })
      .catch((err) => dispatch(errorRequest(err)));
  };
}

export function loadVotes(userId, page) {
  return (dispatch) => {
    dispatch(addVotesStart());

    dispatch(api.getUserVotes(userId, page))
      .then((response) => dispatch(addVotesFinish(response.body)));
  };
}