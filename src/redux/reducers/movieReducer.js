import Immutable from 'immutable';
import {createReducer} from 'redux-immutablejs';

import {
  MOVIE_LOADING_START,
  MOVIE_LOADING_FINISH,
  MOVIE_LOADING_ERROR
} from 'redux/actions/movieActions';

import {VOTE_REQUEST_FINISHED} from 'redux/actions/voteActions';
import {BOOKMARK_REQUEST_FINISHED} from '../actions/bookmarkActions';

const initialState = Immutable.fromJS({
  response: null,
  errors  : null,
  pending : false
});

export default createReducer(initialState, {
  [MOVIE_LOADING_START]: state => state.merge({
    pending: true,
    errors : null
  }),

  [MOVIE_LOADING_FINISH]: (state, action) => state.merge({
    pending : false,
    errors  : null,
    response: action.response
  }),

  [MOVIE_LOADING_ERROR]: (state, action) => {
    return state.merge({
      pending : false,
      errors  : action.err,
      response: null
    });
  },

  [VOTE_REQUEST_FINISHED]: (state, action) => {
    const movie = state.getIn(['response', 'movie']);

    if (!movie || movie.get('id') !== action.response.data.id) {
      return state;
    }

    return  state.updateIn(['response', 'movie'], m => {
      return m.merge(action.response.data);
    });
  },

  [BOOKMARK_REQUEST_FINISHED]: (state, action) => {
    const movie = state.getIn(['response', 'movie']);

    if (!movie || movie.get('id') !== action.response.data.movie_id) {
      return state;
    }

    return  state.updateIn(['response', 'movie'], m => {
      return m.set('inBookmarks', action.response.data.inBookmarks);
    });
  }
});