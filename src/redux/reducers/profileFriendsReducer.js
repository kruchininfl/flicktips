import Immutable from 'immutable';
import {createReducer} from 'redux-immutablejs';

import {
  PROFILE_FRIENDS_LOADING_START,
  PROFILE_FRIENDS_LOADING_FINISH,
  PROFILE_FRIENDS_ADD_START,
  PROFILE_FRIENDS_ADD_FINISH,
  TOGGLE_FRIEND_SUBSCRIBE_START,
  TOGGLE_FRIEND_SUBSCRIBE_FINISH
} from 'redux/actions/profileFriendsActions';

const initialState = Immutable.fromJS({
  response: null,
  errors  : null,
  loading : false,
  pending : false
});

export default createReducer(initialState, {
  [PROFILE_FRIENDS_LOADING_START]: state => state.merge({
    pending: true,
    errors : null
  }),

  [PROFILE_FRIENDS_LOADING_FINISH]: (state, action) => state.merge({
    pending : false,
    errors  : null,
    response: action.response.results
  }),

  [PROFILE_FRIENDS_ADD_START]: (state) => state.merge({loading: true}),

  [PROFILE_FRIENDS_ADD_FINISH]: (state, action) => {
    action.response.results.entities = state.getIn(['response', 'entities']).toJS().concat(action.response.results.entities);
    return state.merge({loading: false, response: action.response.results});
  },

  [TOGGLE_FRIEND_SUBSCRIBE_START]: (state, {friendId}) => {
    let friendIndex = null;
    const friends = state.getIn(['response', 'entities']);

    if (friends && friends.size) {
      friends.forEach((friend, index) => {
        if (friend.get('id') === friendId) {
          friendIndex = index;
        }
      });

      return state
        .setIn(['response', 'entities', friendIndex, 'loading'], true);
    }

    return state;
  },

  [TOGGLE_FRIEND_SUBSCRIBE_FINISH]: (state, action) => {
    let friendIndex = null;
    const friends = state.getIn(['response', 'entities']);

    if (friends && friends.size) {
      friends.forEach((friend, index) => {
        if (friend.get('id') === action.response.friendId) {
          friendIndex = index;
        }
      });

      return state
        .setIn(['response', 'entities', friendIndex, 'subscribed'], action.response.subscribed)
        .setIn(['response', 'entities', friendIndex, 'loading'], false);
    }

    return state;
  }
});