export const PROFILE_FRIENDS_LOADING_START = 'PROFILE_FRIENDS_LOADING_START';
export const PROFILE_FRIENDS_LOADING_FINISH = 'PROFILE_FRIENDS_LOADING_FINISH';
export const PROFILE_FRIENDS_LOADING_ERROR = 'PROFILE_FRIENDS_LOADING_ERROR';
export const PROFILE_FRIENDS_ADD_START = 'PROFILE_FRIENDS_ADD_START';
export const PROFILE_FRIENDS_ADD_FINISH = 'PROFILE_FRIENDS_ADD_FINISH';
export const USER_SUBSCRIBE_FINISH = 'USER_SUBSCRIBE_FINISH';
export const USERS_SEARCH_START = 'USERS_SEARCH_START';
export const USERS_SEARCH_FINISH = 'USERS_SEARCH_FINISH';
export const PROFILE_FRIENDS_FIND_OPEN = 'PROFILE_FRIENDS_FIND_OPEN';
export const RECOMMENDATIONS_FINISH = 'RECOMMENDATIONS_FINISH';

import api from 'api';

function startRequest(listType) {
  return {type: PROFILE_FRIENDS_LOADING_START, listType};
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

// listType: 'following' (people I follow) or 'followers'; the 'find' tab is opened by openFindFriends
export function getUserFriends(listType = 'following') {
  return (dispatch) => {
    dispatch(startRequest(listType));

    return dispatch(api.getUserFriends(1, listType))
      .then((response) => {
        dispatch(finishRequest(response.body));
      })
      .catch((err) => dispatch(errorRequest(err)));
  };
}

export function loadFriends(page) {
  return (dispatch, getState) => {
    dispatch(addFriendsStart());

    dispatch(api.getUserFriends(page, getState().userFriends.get('listType')))
      .then((response) => dispatch(addFriendsFinish(response.body)));
  };
}

// Follow / unfollow any user; every list holding this user (profile, friends, search) updates on finish
export function subscribe(userId, subscribed) {
  return (dispatch) => dispatch(api.subscribe(userId, subscribed))
    .then((response) => dispatch({
      type: USER_SUBSCRIBE_FINISH,
      userId: response.body.userId,
      subscribed: response.body.subscribed
    }));
}

export function searchUsers(query) {
  return (dispatch) => {
    dispatch({type: USERS_SEARCH_START, query});

    if (query.trim().length < 2) {
      return Promise.resolve(dispatch({type: USERS_SEARCH_FINISH, query, results: []}));
    }

    return dispatch(api.searchUsers(query.trim()))
      .then((response) => dispatch({type: USERS_SEARCH_FINISH, query, results: response.body.results}))
      .catch(() => dispatch({type: USERS_SEARCH_FINISH, query, results: []}));
  };
}

// "Найти друзей" tab: people search plus recommended users (reloaded on every open)
export function openFindFriends() {
  return (dispatch) => {
    dispatch({type: PROFILE_FRIENDS_FIND_OPEN});

    return dispatch(api.getRecommendations())
      .then((response) => dispatch({type: RECOMMENDATIONS_FINISH, results: response.body.results}))
      .catch(() => dispatch({type: RECOMMENDATIONS_FINISH, results: []}));
  };
}