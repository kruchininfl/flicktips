import api from 'api';
import Cookies from 'js-cookie';

export const INVITE_CODE_FINISH = 'INVITE_CODE_FINISH';
export const INVITE_LOADING_START = 'INVITE_LOADING_START';
export const INVITE_LOADING_FINISH = 'INVITE_LOADING_FINISH';
export const INVITE_LOADING_ERROR = 'INVITE_LOADING_ERROR';

// a guest who opened an invite link keeps its code here until they sign in (see App)
export const INVITE_COOKIE = 'ft_invite';

// the signed-in user's own invite code, loaded once
export function loadInviteCode() {
  return (dispatch, getState) => {
    if (getState().invite.get('code')) {
      return Promise.resolve();
    }

    return dispatch(api.getInviteCode())
      .then((response) => dispatch({type: INVITE_CODE_FINISH, code: response.body.code}))
      .catch(() => false);
  };
}

// who sent the invite with this code
export function getInvite(code) {
  return (dispatch) => {
    dispatch({type: INVITE_LOADING_START});

    return dispatch(api.getInvite(code))
      .then((response) => dispatch({type: INVITE_LOADING_FINISH, inviter: response.body.user}))
      .catch((err) => dispatch({type: INVITE_LOADING_ERROR, err}));
  };
}

// makes the current user and the inviter follow each other; resolves with the inviter id
export function acceptInvite(code) {
  return (dispatch) => dispatch(api.acceptInvite(code))
    .then((response) => response.body.inviterId);
}

export function rememberInvite(code) {
  Cookies.set(INVITE_COOKIE, code, {expires: 7, path: '/'});
}

export function takeRememberedInvite() {
  const code = Cookies.get(INVITE_COOKIE);

  if (code) {
    Cookies.remove(INVITE_COOKIE, {path: '/'});
  }

  return code;
}