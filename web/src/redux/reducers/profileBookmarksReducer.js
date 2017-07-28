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
  [BOOKMARKS_GET_STARTED]: state => state.mergeDeep({
    pending: true,
    errors : null
  }),

  [BOOKMARKS_GET_FINISHED]: (state, action) => state.mergeDeep({
    pending : false,
    errors  : null,
    response: action.response.results
  }),

  [BOOKMARKS_GET_ERROR]: (state, errors) => state.mergeDeep({errors}),

  [BOOKMARKS_ADD_STARTED]: (state) => state.mergeDeep({loading: true}),

  [BOOKMARKS_ADD_FINISHED]: (state, action) => {
    action.response.results.entities = state.getIn(['response', 'entities']).toJS().concat(action.response.results.entities);
    return state.mergeDeep({loading: false, response: action.response.results});
  },

  [VOTE_REQUEST_FINISHED]: (state, action) => {
    const entities = [];
    const results = state.getIn(['response', 'entities']);

    if (results && results.size) {
      results.forEach(entity => {
        if (entity.get('id') === action.response.data.id) {
          entities.push(Object.assign({}, entity.toJS, action.response.data));
        } else {
          entities.push(entity.toJS());
        }
      });

      return state.mergeDeep({
        response: Object.assign({}, state.get('response').toJS(), {entities})
      });
    }

    return state;
  },

  [BOOKMARK_REQUEST_FINISHED]: (state, action) => {
    let entityIndex = null;
    const results = state.getIn(['response', 'entities']);

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
        ['response', 'entities', entityIndex, 'inBookmarks'],
        action.response.data.inBookmarks
      );
    }

    return state;
  }
});