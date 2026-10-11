import Immutable from 'immutable';
import {createReducer} from 'redux-immutablejs';

import {
  SIGN_IN_POPUP_OPEN,
  SIGN_IN_POPUP_CLOSE,
  NOT_FOUND
} from 'redux/actions/appActions';

import {OAUTH_SIGN_IN_COMPLETE} from '../../partitions/redux-oauth';

const initialState = Immutable.fromJS({
  signInPopupOpen: false,
  notFound: false
});

export default createReducer(initialState, {
  [SIGN_IN_POPUP_OPEN]: state => state.merge({signInPopupOpen: true}),

  [SIGN_IN_POPUP_CLOSE]: state => state.merge({signInPopupOpen: false}),

  [OAUTH_SIGN_IN_COMPLETE]: state => state.merge({signInPopupOpen: false}),

  [NOT_FOUND]: state => state.merge({notFound: true})
});