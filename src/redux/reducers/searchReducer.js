import Immutable from 'immutable';
import {createReducer} from 'redux-immutablejs';

import {
  SEARCH_REQUEST_STARTED,
  SEARCH_REQUEST_FINISHED,
  SEARCH_REQUEST_ERROR,
  SEARCH_REQUEST_CLEAR
} from 'redux/actions/searchActions';

import {
  VOTE_REQUEST_STARTED,
  VOTE_REQUEST_FINISHED,
  VOTE_REQUEST_ERROR
} from 'redux/actions/voteActions';
import {BOOKMARK_REQUEST_FINISHED} from '../actions/bookmarkActions';

const initialState = Immutable.fromJS({
  response: null,
  errors  : null,
  pending : false
});

export default createReducer(initialState, {
  [SEARCH_REQUEST_STARTED]: state => {
    return state.merge({pending: true, errors: null});
  },

  [SEARCH_REQUEST_FINISHED]: (state, action) => {
    state.delete('response');
    return initialState.mergeDeep({
      pending : false,
      errors  : null,
      response: action.response
    });
  },

  [SEARCH_REQUEST_CLEAR]: () => initialState,

  [SEARCH_REQUEST_ERROR]: (state, action) => state.merge({pending: false, errors: action.errors}),

  [VOTE_REQUEST_STARTED]: (state) => state.merge({errors: null}),

  [VOTE_REQUEST_FINISHED]: (state, action) => {
    if (!state.getIn(['response', 'results'])) {
      return state;
    }

    return state.updateIn(
      ['response', 'results'],
      (entities) => entities.map((entity) => {
        if (entity.get('id') === action.response.data.id) {
          return entity.mergeDeep(action.response.data);
        }

        return entity;
      })
    );
  },

  [BOOKMARK_REQUEST_FINISHED]: (state, action) => {
    if (!state.getIn(['response', 'results'])) {
      return state;
    }

    return state.updateIn(
      ['response', 'results'],
      (entities) => entities.map((entity) => {
        if (entity.get('id') === action.response.data.movie_id) {
          return entity.set('inBookmarks', action.response.data.inBookmarks);
        }

        return entity;
      })
    );
  },

  [VOTE_REQUEST_ERROR]: (state, action) => state.merge({errors: action.errors})
});