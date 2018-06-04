import Immutable from 'immutable';
import {createReducer} from 'redux-immutablejs';

import {
  LAST_GRADED_LOADING_START,
  LAST_GRADED_LOADING_FINISH,
  LAST_GRADED_ADD_START,
  LAST_GRADED_ADD_FINISH
} from 'redux/actions/lastGradedActions';

import {VOTE_REQUEST_FINISHED} from 'redux/actions/voteActions';
import {BOOKMARK_REQUEST_FINISHED} from '../actions/bookmarkActions';

const initialState = Immutable.fromJS({
  loading    : false,
  pending    : false,
  errors     : null,
  response   : null,
  onlyFriends: null
});

export default createReducer(initialState, {
  [LAST_GRADED_LOADING_START]: state => state.merge({
    pending: true,
    errors : null
  }),

  [LAST_GRADED_LOADING_FINISH]: (state, action) => {
    return state.merge({
      pending    : false,
      errors     : null,
      response   : action.response,
      onlyFriends: action.onlyFriends
    });
  },

  [LAST_GRADED_ADD_START]: (state) => state.merge({loading: true}),

  [LAST_GRADED_ADD_FINISH]: (state, action) => {
    return state
      .set('loading', false)
      .mergeIn(['response'], {results: action.response.results});
  },

  [VOTE_REQUEST_FINISHED]: (state, action) => {
    if (!state.getIn(['response', 'results', 'entities'])) {
      return state;
    }

    return state.updateIn(
      ['response', 'results', 'entities'],
      (entities) => entities.map((entity) => {
        if (entity.get('id') === action.response.data.id) {
          return entity.mergeDeep(action.response.data);
        }

        return entity;
      })
    );
  },

  [BOOKMARK_REQUEST_FINISHED]: (state, action) => {
    if (!state.getIn(['response', 'results', 'entities'])) {
      return state;
    }

    return state.updateIn(
      ['response', 'results', 'entities'],
      (entities) => entities.map((entity) => {
        if (entity.get('id') === action.response.data.movie_id) {
          return entity.set('inBookmarks', action.response.data.inBookmarks);
        }

        return entity;
      })
    );
  }
});