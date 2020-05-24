import Immutable from 'immutable';
import {createReducer} from 'redux-immutablejs';

import {
  MOVIE_LOADING_START,
  MOVIE_LOADING_FINISH,
  MOVIE_LOADING_ERROR,
  MOVIE_VOTES_LOADING_START,
  MOVIE_VOTES_LOADING_FINISH,
  MOVIE_VOTES_LOADING_ERROR
} from 'redux/actions/movieActions';

import {VOTE_REQUEST_FINISHED} from 'redux/actions/voteActions';
import {BOOKMARK_REQUEST_FINISHED} from '../actions/bookmarkActions';
import {MOVIE_UPDATE_AND_GET_POSTER_FINISH} from '../actions/movieActions';

const initialState = Immutable.fromJS({
  response    : null,
  errors      : null,
  pending     : false,
  pendingVotes: false,
  errorsVotes : null
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
  },

  [MOVIE_VOTES_LOADING_START]: state => state.merge({
    pendingVotes: true,
    errors : null
  }),

  [MOVIE_VOTES_LOADING_FINISH]: (state, action) => {
    const movie = state.getIn(['response', 'movie']);

    if (!movie || movie.get('id') !== action.response.movie_id) {
      return state.set('pendingVotes', false);
    }

    return  state.set('pendingVotes', false).updateIn(['response', 'movie'], m => {
      return m.set('allVotes', action.response.votes);
    });
  },

  [MOVIE_VOTES_LOADING_ERROR]: (state, action) => {
    return state.merge({
      pendingVotes : false,
      errorsVotes  : action.err
    });
  },

  [MOVIE_UPDATE_AND_GET_POSTER_FINISH]: (state, action) => {
    const movie = state.getIn(['response', 'movie']);

    if (!movie || movie.get('id') !== +action.response.movie_id) {
      return state;
    }

    return state.setIn(['response', 'movie', 'tmdb_poster_path'], action.response.poster_path);
  }
});