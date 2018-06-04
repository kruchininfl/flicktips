import Immutable from 'immutable';
import {createReducer} from 'redux-immutablejs';

import {
  TRENDS_LOADING_START,
  TRENDS_LOADING_FINISH,
  TRENDS_ADD_START,
  TRENDS_ADD_FINISH
} from 'redux/actions/trendsActions';

import {VOTE_REQUEST_FINISHED} from 'redux/actions/voteActions';
import {BOOKMARK_REQUEST_FINISHED} from '../actions/bookmarkActions';

const initialState = Immutable.fromJS({
  loading : false,
  pending : false,
  errors  : null,
  response: null
});

export default createReducer(initialState, {
  [TRENDS_LOADING_START]: state => state.merge({
    pending: true,
    errors : null
  }),

  [TRENDS_LOADING_FINISH]: (state, action) => state.merge({
    pending : false,
    errors  : null,
    response: action.response
  }),

  [TRENDS_ADD_START]: (state) => state.merge({loading: true}),

  [TRENDS_ADD_FINISH]: (state, action) => {
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