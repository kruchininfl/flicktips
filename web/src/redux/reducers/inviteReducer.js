import Immutable from 'immutable';
import {createReducer} from 'redux-immutablejs';

import {
  INVITE_CODE_FINISH,
  INVITE_LOADING_START,
  INVITE_LOADING_FINISH,
  INVITE_LOADING_ERROR
} from 'redux/actions/inviteActions';

const initialState = Immutable.fromJS({
  code   : null,
  inviter: null,
  pending: false,
  errors : null
});

export default createReducer(initialState, {
  [INVITE_CODE_FINISH]: (state, {code}) => state.set('code', code),

  [INVITE_LOADING_START]: (state) => state.merge({pending: true, inviter: null, errors: null}),

  [INVITE_LOADING_FINISH]: (state, {inviter}) => state.merge({pending: false, inviter}),

  [INVITE_LOADING_ERROR]: (state, {err}) => state.merge({pending: false, errors: err ? err.message : true})
});