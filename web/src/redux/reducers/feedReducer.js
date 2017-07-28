import Immutable from 'immutable';
import {createReducer} from 'redux-immutablejs';

import {
  FEED_LOADING_START,
  FEED_LOADING_FINISH,
  FEED_ADD_VOTES_START,
  FEED_ADD_VOTES_FINISH,
  FEED_RESET
} from 'redux/actions/feedActions';

import {
  VOTE_REQUEST_FINISHED
} from 'redux/actions/voteActions';
import {BOOKMARK_REQUEST_FINISHED} from '../actions/bookmarkActions';

const initialState = Immutable.fromJS({
  loading : false,
  pending : false,
  errors  : null,
  response: null
});

export default createReducer(initialState, {
  [FEED_LOADING_START]: state => state.mergeDeep({
    pending: true,
    errors : null
  }),

  [FEED_LOADING_FINISH]: (state, action) => state.mergeDeep({
    pending : false,
    errors  : null,
    response: action.response
  }),

  [FEED_ADD_VOTES_START]: (state) => state.mergeDeep({loading: true}),

  [FEED_ADD_VOTES_FINISH]: (state, action) => {
    // const entities = state
    //   .getIn(['response', 'results', 'entities']).toJS()
    //   .concat(action.response.results.entities);

    return state
      .set('loading', false)
      .mergeIn(['response'], {results: action.response.results});
      // .mergeIn(['response', 'results'], {entities});
  },

  [VOTE_REQUEST_FINISHED]: (state, action) => {
    let entityIndex = null;
    const results = state.getIn(['response', 'results', 'entities']);

    if (results && results.size) {
      results.forEach((entity, index) => {
        if (entity.getIn(['movie', 'id']) === action.response.data.id) {
          entityIndex = index;
        }
      });

      if (entityIndex === null) {
        return state;
      }

      return state.mergeDeepIn(['response', 'results', 'entities', entityIndex, 'movie'], action.response.data);
    }

    return state;
  },

  [BOOKMARK_REQUEST_FINISHED]: (state, action) => {
    let entityIndex = null;
    const results = state.getIn(['response', 'results', 'entities']);

    if (results && results.size) {
      results.forEach((entity, index) => {
        if (entity.getIn(['movie', 'id']) === action.response.data.movie_id) {
          entityIndex = index;
        }
      });

      if (entityIndex === null) {
        return state;
      }

      return state.setIn(
        ['response', 'results', 'entities', entityIndex, 'movie', 'inBookmarks'],
        action.response.data.inBookmarks
      );
    }

    return state;
  },

  [FEED_RESET]: () => initialState.mergeDeep({pending: true})
});