import {combineReducers} from 'redux';
import appReducer from './appReducer';
import searchReducer from './searchReducer';
import profileReducer from './profileReducer';
import profileFriendsReducer from './profileFriendsReducer';
import {authStateReducer} from 'redux-oauth';
import {reducer as reduxAsyncConnect} from 'redux-connect';
import feedReducer from './feedReducer';
import profileBookmarksReducer from './profileBookmarksReducer';

export default combineReducers({
  app          : appReducer,
  feed         : feedReducer,
  auth         : authStateReducer,
  search       : searchReducer,
  profile      : profileReducer,
  userFriends  : profileFriendsReducer,
  userBookmarks: profileBookmarksReducer,
  reduxAsyncConnect
});