import Immutable from 'immutable';
import {createReducer} from 'redux-immutablejs';

import {
  SIGN_IN_POPUP_OPEN,
  SIGN_IN_POPUP_CLOSE,
  NOT_FOUND,
  SEARCH_OPEN,
  SEARCH_CLOSE
} from 'redux/actions/appActions';

import {OAUTH_SIGN_IN_COMPLETE} from '../../partitions/redux-oauth';

const initialState = Immutable.fromJS({
  signInPopupOpen: false,
  notFound: false,
  searchOpened: false
});

export default createReducer(initialState, {
  [SIGN_IN_POPUP_OPEN]: state => state.merge({signInPopupOpen: true}),

  [SIGN_IN_POPUP_CLOSE]: state => state.merge({signInPopupOpen: false}),

  [OAUTH_SIGN_IN_COMPLETE]: state => state.merge({signInPopupOpen: false}),

  [NOT_FOUND]: state => state.merge({notFound: true}),

  [SEARCH_OPEN]: state => state.merge({searchOpened: true}),

  [SEARCH_CLOSE]: state => state.merge({searchOpened: false})
});