import Immutable from 'immutable';
import {createReducer} from 'redux-immutablejs';

import {
  PROFILE_FRIENDS_LOADING_START,
  PROFILE_FRIENDS_LOADING_FINISH,
  PROFILE_FRIENDS_ADD_START,
  PROFILE_FRIENDS_ADD_FINISH,
  USER_SUBSCRIBE_FINISH,
  USERS_SEARCH_START,
  USERS_SEARCH_FINISH,
  PROFILE_FRIENDS_FIND_OPEN,
  RECOMMENDATIONS_FINISH
} from 'redux/actions/profileFriendsActions';

const initialState = Immutable.fromJS({
  response: null,
  listType: 'following',
  errors  : null,
  loading : false,
  pending : false,
  search  : {
    query  : '',
    results: [],
    loading: false
  },
  recommendations: {
    items  : [],
    pending: false
  }
});

function setSubscribed(users, userId, subscribed) {
  if (!users) {
    return users;
  }

  return users.map((user) => (user.get('id') === userId ? user.set('subscribed', subscribed) : user));
}

export default createReducer(initialState, {
  [PROFILE_FRIENDS_LOADING_START]: (state, {listType}) => state.merge({
    pending : true,
    errors  : null,
    listType
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

  [USER_SUBSCRIBE_FINISH]: (state, {userId, subscribed}) => {
    const nextState = state
      .updateIn(['search', 'results'], (users) => setSubscribed(users, userId, subscribed))
      .updateIn(['recommendations', 'items'], (users) => setSubscribed(users, userId, subscribed));

    if (!state.get('response')) {
      return nextState;
    }

    return nextState.updateIn(['response', 'entities'], (users) => setSubscribed(users, userId, subscribed));
  },

  [PROFILE_FRIENDS_FIND_OPEN]: (state) => state
    .set('listType', 'find')
    .setIn(['recommendations', 'pending'], true),

  [RECOMMENDATIONS_FINISH]: (state, {results}) => state
    .setIn(['recommendations', 'pending'], false)
    .setIn(['recommendations', 'items'], Immutable.fromJS(results)),

  [USERS_SEARCH_START]: (state, {query}) => state.mergeIn(['search'], {query, loading: true}),

  // answers to older queries arrive late and are dropped
  [USERS_SEARCH_FINISH]: (state, {query, results}) => {
    if (state.getIn(['search', 'query']) !== query) {
      return state;
    }

    return state.mergeIn(['search'], {loading: false}).setIn(['search', 'results'], Immutable.fromJS(results));
  }
});