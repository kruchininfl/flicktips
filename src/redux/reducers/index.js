import {combineReducers} from 'redux';
import appReducer from './appReducer';
import searchReducer from './searchReducer';
import profileReducer from './profileReducer';
import profileFriendsReducer from './profileFriendsReducer';
import {authStateReducer} from 'redux-oauth';
import {reducer as reduxAsyncConnect} from 'redux-connect';
import feedReducer from './feedReducer';
import profileBookmarksReducer from './profileBookmarksReducer';
// import trendsReducer from './trendsReducer';
import lastGradedReducer from './lastGraded';
import movieReducer from './movieReducer';
import personReducer from './personReducer';
import {loadingBarReducer} from 'react-redux-loading-bar';

export default combineReducers({
  app          : appReducer,
  feed         : feedReducer,
  // trends       : trendsReducer,
  lastGraded   : lastGradedReducer,
  auth         : authStateReducer,
  search       : searchReducer,
  profile      : profileReducer,
  userFriends  : profileFriendsReducer,
  userBookmarks: profileBookmarksReducer,
  loadingBar   : loadingBarReducer,
  movie        : movieReducer,
  person       : personReducer,
  reduxAsyncConnect
});