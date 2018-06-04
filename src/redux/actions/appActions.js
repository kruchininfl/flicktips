export const SIGN_IN_POPUP_OPEN = 'SIGN_IN_POPUP_OPEN';
export const SIGN_IN_POPUP_CLOSE = 'SIGN_IN_POPUP_CLOSE';
export const IS_VK_APP = 'IS_VK_APP';
export const NOT_FOUND = 'NOT_FOUND';

export function openSignInPopup() {
  return {type: SIGN_IN_POPUP_OPEN};
}

export function closeSignInPopup() {
  return {type: SIGN_IN_POPUP_CLOSE};
}

export function setAsVkApp() {
  return {type: IS_VK_APP};
}

export function setAsNotFound() {
  return {type: NOT_FOUND};
}