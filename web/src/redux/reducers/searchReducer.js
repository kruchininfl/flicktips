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

const initialState = Immutable.fromJS({
  response: null,
  errors  : null,
  pending : false
});

export default createReducer(initialState, {
  [SEARCH_REQUEST_STARTED]: state => {
    return state.mergeDeep({pending: true, errors: null});
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

  [SEARCH_REQUEST_ERROR]: (state, action) => state.mergeDeep({pending: false, errors: action.errors}),

  [VOTE_REQUEST_STARTED]: (state) => state.mergeDeep({errors: null}),

  [VOTE_REQUEST_FINISHED]: (state, action) => {
    const entities = [];
    const results = state.getIn(['response', 'results']);

    if (results && results.size) {
      results.forEach(entity => {
        if (entity.get('id') === action.response.data.id) {
          entities.push(Object.assign({}, entity.toJS, action.response.data));
        } else {
          entities.push(entity.toJS());
        }
      });

      return state.mergeDeep({
        response: Object.assign({}, state.get('response').toJS(), {results: entities})
      });
    }

    return state;
  },

  [VOTE_REQUEST_ERROR]: (state, action) => state.mergeDeep({errors: action.errors})
});