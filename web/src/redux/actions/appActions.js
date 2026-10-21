export const SIGN_IN_POPUP_OPEN = 'SIGN_IN_POPUP_OPEN';
export const SIGN_IN_POPUP_CLOSE = 'SIGN_IN_POPUP_CLOSE';
export const NOT_FOUND = 'NOT_FOUND';
export const SEARCH_OPEN = 'SEARCH_OPEN';
export const SEARCH_CLOSE = 'SEARCH_CLOSE';

export function openSignInPopup() {
  return {type: SIGN_IN_POPUP_OPEN};
}

export function closeSignInPopup() {
  return {type: SIGN_IN_POPUP_CLOSE};
}

export function setAsNotFound() {
  return {type: NOT_FOUND};
}

export function openSearch() {
  return {type: SEARCH_OPEN};
}

export function closeSearch() {
  return {type: SEARCH_CLOSE};
}