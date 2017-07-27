import {combineReducers} from 'redux';
import appReducer from './appReducer';
import searchReducer from './searchReducer';
import profileReducer from './profileReducer';
import {authStateReducer} from 'redux-oauth';
import {reducer as reduxAsyncConnect} from 'redux-connect';
import feedReducer from './feedReducer';

export default combineReducers({
  app    : appReducer,
  feed    : feedReducer,
  auth   : authStateReducer,
  search : searchReducer,
  profile: profileReducer,
  reduxAsyncConnect
});