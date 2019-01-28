import {applyMiddleware, createStore} from 'redux';
import thunk from 'redux-thunk';
import rootReducer from './reducers';
import {loadingBarMiddleware} from 'react-redux-loading-bar';
import {composeWithDevTools} from 'redux-devtools-extension';

export default function (initialState = {}) {
  const store = createStore(rootReducer, initialState, composeWithDevTools(
    applyMiddleware(thunk),
    applyMiddleware(loadingBarMiddleware({
      promiseTypeSuffixes: ['BEGIN_GLOBAL_LOAD', 'END_GLOBAL_LOAD', 'FAILURE']
    }))
    )
  );

  if (module.hot) {
    module.hot.accept('./reducers', () =>
      store.replaceReducer(require('./reducers').default)
    );
  }

  return store;
}