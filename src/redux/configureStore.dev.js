import {applyMiddleware, createStore, compose} from 'redux';
import thunk from 'redux-thunk';
import DevTools from 'components/DevTools';
import rootReducer from './reducers';
import {loadingBarMiddleware} from 'react-redux-loading-bar';

export default function (initialState = {}) {
  const store = createStore(rootReducer, initialState, compose(
    applyMiddleware(thunk),
    applyMiddleware(loadingBarMiddleware({
      promiseTypeSuffixes: ['BEGIN_GLOBAL_LOAD', 'END_GLOBAL_LOAD', 'FAILURE']
    })),
    DevTools.instrument()
    )
  );

  if (module.hot) {
    module.hot.accept('./reducers', () =>
      store.replaceReducer(require('./reducers').default)
    );
  }

  return store;
}