import Immutable from 'immutable';
import {createReducer} from 'redux-immutablejs';

import {
  PROFILE_LOADING_START,
  PROFILE_LOADING_FINISH,
  PROFILE_RESET,
  PROFILE_ADD_VOTES_START,
  PROFILE_ADD_VOTES_FINISH
} from 'redux/actions/profileActions';

import {
  VOTE_REQUEST_FINISHED
} from 'redux/actions/voteActions';
import {BOOKMARK_REQUEST_FINISHED} from '../actions/bookmarkActions';

const initialState = Immutable.fromJS({
  user    : null,
  votes   : null,
  errors  : null,
  loading : false,
  isMyPage: false,
  pending : false
});

export default createReducer(initialState, {
  [PROFILE_LOADING_START]: state => state.mergeDeep({
    pending: true,
    errors : null
  }),

  [PROFILE_LOADING_FINISH]: (state, action) => state.mergeDeep({
    pending : false,
    errors  : null,
    votes   : action.response.votes,
    user    : action.response.user,
    isMyPage: action.response.isMyPage
  }),

  [PROFILE_ADD_VOTES_START]: (state) => state.mergeDeep({loading: true}),

  [PROFILE_ADD_VOTES_FINISH]: (state, action) => {
    action.response.results.entities = state.getIn(['votes', 'entities']).toJS().concat(action.response.results.entities);
    return state.mergeDeep({loading: false, votes: action.response.results});
  },

  [VOTE_REQUEST_FINISHED]: (state, action) => {
    const entities = [];
    const results = state.getIn(['votes', 'entities']);

    if (results && results.size) {
      results.forEach(entity => {
        if (entity.get('id') === action.response.data.id) {
          entities.push(Object.assign({}, entity.toJS, action.response.data));
        } else {
          entities.push(entity.toJS());
        }
      });

      return state.mergeDeep({
        votes: Object.assign({}, state.get('votes').toJS(), {entities})
      });
    }

    return state;
  },

  [BOOKMARK_REQUEST_FINISHED]: (state, action) => {
    let entityIndex = null;
    const results = state.getIn(['votes', 'entities']);

    if (results && results.size) {
      results.forEach((entity, index) => {
        if (entity.get('id') === action.response.data.movie_id) {
          entityIndex = index;
        }
      });

      if (entityIndex === null) {
        return state;
      }

      return state.setIn(
        ['votes', 'entities', entityIndex, 'inBookmarks'],
        action.response.data.inBookmarks
      );
    }

    return state;
  },

  [PROFILE_RESET]: () => initialState.mergeDeep({pending: true})
});