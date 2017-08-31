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
  [FEED_LOADING_START]: state => state.merge({
    pending: true,
    errors : null
  }),

  [FEED_LOADING_FINISH]: (state, action) => state.merge({
    pending : false,
    errors  : null,
    response: action.response
  }),

  [FEED_ADD_VOTES_START]: (state) => state.merge({loading: true}),

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
    if (!state.getIn(['response', 'results', 'entities'])) {
      return state;
    }

    return state.updateIn(
      ['response', 'results', 'entities'],
      (entities) => entities.map((entity) => {
        if (entity.getIn(['movie', 'id']) === action.response.data.id) {
          return entity.mergeDeep({movie: action.response.data});
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
        if (entity.getIn(['movie', 'id']) === action.response.data.movie_id) {
          return entity.setIn(['movie', 'inBookmarks'], action.response.data.inBookmarks);
        }

        return entity;
      })
    );
  },

  [FEED_RESET]: () => initialState.mergeDeep({pending: true})
});