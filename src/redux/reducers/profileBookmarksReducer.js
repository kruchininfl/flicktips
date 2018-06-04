import Immutable from 'immutable';
import {createReducer} from 'redux-immutablejs';

import {
  BOOKMARKS_GET_STARTED,
  BOOKMARKS_GET_FINISHED,
  BOOKMARKS_GET_ERROR,
  BOOKMARKS_ADD_STARTED,
  BOOKMARKS_ADD_FINISHED
} from 'redux/actions/bookmarkActions';
import {VOTE_REQUEST_FINISHED} from '../actions/voteActions';
import {BOOKMARK_REQUEST_FINISHED} from '../actions/bookmarkActions';

const initialState = Immutable.fromJS({
  response: null,
  errors  : null,
  loading : false,
  pending : false
});

export default createReducer(initialState, {
  [BOOKMARKS_GET_STARTED]: state => state.merge({
    pending: true,
    errors : null
  }),

  [BOOKMARKS_GET_FINISHED]: (state, action) => {
    return state.merge({
      pending : false,
      errors  : null,
      response: action.response.results
    }).set('response', Immutable.fromJS(action.response.results));
  },

  [BOOKMARKS_GET_ERROR]: (state, errors) => state.merge({errors}),

  [BOOKMARKS_ADD_STARTED]: (state) => state.merge({loading: true}),

  [BOOKMARKS_ADD_FINISHED]: (state, action) => {
    action.response.results.entities = state.getIn(['response', 'entities']).toJS().concat(action.response.results.entities);
    return state.merge({loading: false, response: action.response.results});
  },

  [VOTE_REQUEST_FINISHED]: (state, action) => {
    if (!state.getIn(['response', 'entities'])) {
      return state;
    }

    return state.updateIn(
      ['response', 'entities'],
      (entities) => entities.map((entity) => {
        if (entity.get('id') === action.response.data.id) {
          return entity.mergeDeep(action.response.data);
        }

        return entity;
      })
    );
  },

  [BOOKMARK_REQUEST_FINISHED]: (state, action) => {
    if (!state.getIn(['response', 'entities'])) {
      return state;
    }

    return state.updateIn(
      ['response', 'entities'],
      (entities) => entities.map((entity) => {
        if (entity.get('id') === action.response.data.movie_id) {
          return entity.set('inBookmarks', action.response.data.inBookmarks);
        }

        return entity;
      })
    );
  }
});