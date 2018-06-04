import Immutable from 'immutable';
import {createReducer} from 'redux-immutablejs';

import {
  SIGN_IN_POPUP_OPEN,
  SIGN_IN_POPUP_CLOSE,
  IS_VK_APP,
  NOT_FOUND
} from 'redux/actions/appActions';

import {OAUTH_SIGN_IN_COMPLETE} from 'redux-oauth';

const initialState = Immutable.fromJS({
  signInPopupOpen: false,
  isVkApp: false,
  notFound: false
});

export default createReducer(initialState, {
  [SIGN_IN_POPUP_OPEN]: state => state.merge({signInPopupOpen: true}),

  [SIGN_IN_POPUP_CLOSE]: state => state.merge({signInPopupOpen: false}),

  [OAUTH_SIGN_IN_COMPLETE]: state => state.merge({signInPopupOpen: false}),

  [IS_VK_APP]: state => state.merge({isVkApp: true}),

  [NOT_FOUND]: state => state.merge({notFound: true})
});