import Immutable from 'immutable';
import {createReducer} from 'redux-immutablejs';

import {
  PROFILE_LOADING_START,
  PROFILE_LOADING_FINISH,
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
    user    : action.response.user,
    isMyPage: action.response.isMyPage
  }).set('votes', action.response.votes),

  [PROFILE_ADD_VOTES_START]: (state) => state.mergeDeep({loading: true}),

  [PROFILE_ADD_VOTES_FINISH]: (state, action) => {
    action.response.results.entities = state.getIn(['votes', 'entities']).toJS().concat(action.response.results.entities);
    return state.mergeDeep({loading: false, votes: action.response.results});
  },

  [VOTE_REQUEST_FINISHED]: (state, action) => {
    if (!state.getIn(['votes', 'entities'])) {
      return state;
    }

    return state.updateIn(
      ['votes', 'entities'],
      (entities) => entities.map((entity) => {
        if (entity.get('id') === action.response.data.id) {
          return entity.mergeDeep(action.response.data);
        }

        return entity;
      })
    );
  },

  [BOOKMARK_REQUEST_FINISHED]: (state, action) => {
    if (!state.getIn(['votes', 'entities'])) {
      return state;
    }

    return state.updateIn(
      ['votes', 'entities'],
      (entities) => entities.map((entity) => {
        if (entity.get('id') === action.response.data.movie_id) {
          return entity.set('inBookmarks', action.response.data.inBookmarks);
        }

        return entity;
      })
    );
  }
});