import Immutable from 'immutable';
import {createReducer} from 'redux-immutablejs';

import {
  SIGN_IN_POPUP_OPEN,
  SIGN_IN_POPUP_CLOSE
} from 'redux/actions/appActions';


const initialState = Immutable.fromJS({
  signInPopupOpen: false
});

export default createReducer(initialState, {
  [SIGN_IN_POPUP_OPEN]: state => state.mergeDeep({signInPopupOpen: true}),

  [SIGN_IN_POPUP_CLOSE]: state => state.mergeDeep({signInPopupOpen: false})
});