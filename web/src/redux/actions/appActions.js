export const SIGN_IN_POPUP_OPEN = 'SIGN_IN_POPUP_OPEN';
export const SIGN_IN_POPUP_CLOSE = 'SIGN_IN_POPUP_CLOSE';

export function openSignInPopup() {
  return {type: SIGN_IN_POPUP_OPEN};
}

export function closeSignInPopup() {
  return {type: SIGN_IN_POPUP_CLOSE};
}