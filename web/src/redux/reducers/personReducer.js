import Immutable from 'immutable';
import {createReducer} from 'redux-immutablejs';

import {
  PERSON_LOADING_START,
  PERSON_LOADING_FINISH,
  PERSON_LOADING_ERROR
} from 'redux/actions/personActions';

const initialState = Immutable.fromJS({
  response: null,
  errors  : null,
  pending : false
});

export default createReducer(initialState, {
  [PERSON_LOADING_START]: state => state.merge({
    pending: true,
    errors : null
  }),

  [PERSON_LOADING_FINISH]: (state, action) => state.merge({
    pending : false,
    errors  : null,
    response: action.response
  }),

  [PERSON_LOADING_ERROR]: (state, action) => {
    return state.merge({
      pending : false,
      errors  : action.err,
      response: null
    });
  }
});