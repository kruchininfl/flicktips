import {applyMiddleware, createStore, compose} from 'redux';
import thunk from 'redux-thunk';
import rootReducer from './reducers';
import {loadingBarMiddleware} from 'react-redux-loading-bar';

export default function (initialState = {}) {
  return createStore(rootReducer, initialState, compose(
    applyMiddleware(thunk),
    applyMiddleware(loadingBarMiddleware({
      promiseTypeSuffixes: ['BEGIN_GLOBAL_LOAD', 'END_GLOBAL_LOAD', 'FAILURE']
    }))
  ));
}