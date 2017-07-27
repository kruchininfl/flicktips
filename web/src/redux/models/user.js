export function isUserSignedIn(state) {
  return state.auth.getIn(['user', 'isSignedIn']);
}

export function getUserModel(state) {
  return state.auth.getIn(['user', 'attributes']);
}