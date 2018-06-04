export const PROFILE_FRIENDS_LOADING_START = 'PROFILE_FRIENDS_LOADING_START';
export const PROFILE_FRIENDS_LOADING_FINISH = 'PROFILE_FRIENDS_LOADING_FINISH';
export const PROFILE_FRIENDS_LOADING_ERROR = 'PROFILE_FRIENDS_LOADING_ERROR';
export const PROFILE_FRIENDS_ADD_START = 'PROFILE_FRIENDS_ADD_START';
export const PROFILE_FRIENDS_ADD_FINISH = 'PROFILE_FRIENDS_ADD_FINISH';
export const TOGGLE_FRIEND_SUBSCRIBE_START = 'TOGGLE_FRIEND_SUBSCRIBE_START';
export const TOGGLE_FRIEND_SUBSCRIBE_FINISH = 'TOGGLE_FRIEND_SUBSCRIBE_FINISH';

import api from 'api';

function startRequest() {
  return {type: PROFILE_FRIENDS_LOADING_START};
}

function finishRequest(response) {
  return {type: PROFILE_FRIENDS_LOADING_FINISH, response};
}

function errorRequest(err) {
  return {type: PROFILE_FRIENDS_LOADING_ERROR, err};
}

function addFriendsStart() {
  return {type: PROFILE_FRIENDS_ADD_START};
}

function addFriendsFinish(response) {
  return {type: PROFILE_FRIENDS_ADD_FINISH, response};
}

export function getUserFriends() {
  return (dispatch) => {
    dispatch(startRequest());

    return dispatch(api.getUserFriends())
      .then((response) => {
        dispatch(finishRequest(response.body));
      })
      .catch((err) => dispatch(errorRequest(err)));
  };
}

export function loadFriends(page) {
  return (dispatch) => {
    dispatch(addFriendsStart());

    dispatch(api.getUserFriends(page))
      .then((response) => dispatch(addFriendsFinish(response.body)));
  };
}

export function toggleSubscribe(friendId) {
  return (dispatch) => {
    dispatch({
      type: TOGGLE_FRIEND_SUBSCRIBE_START,
      friendId
    });

    dispatch(api.toggleSubscribe(friendId))
      .then((response) => dispatch({
        type: TOGGLE_FRIEND_SUBSCRIBE_FINISH,
        response: response.body
      }));
  };
}