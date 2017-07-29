import React      from 'react';
import ReactDOM   from 'react-dom';
import {browserHistory, Router, useRouterHistory} from 'react-router';
import {createHashHistory} from 'history';
import routes from './routes';
import {Provider} from 'react-redux';
import configureStore from './redux/configureStore';
import DevTools from './components/DevTools';
import {ReduxAsyncConnect} from 'redux-connect';

const initialState = window.REDUX_INITIAL_STATE || {};
const store = configureStore(initialState);

function asyncRender(props) {
  return <ReduxAsyncConnect {...props} />;
}

let appHistory = browserHistory;

if (process.env.NODE_ENV === 'cordova') {
  appHistory = useRouterHistory(createHashHistory)({queryKey: false});
}

const component = (
  <Provider store={store}>
    <Router history={appHistory} render={asyncRender}>
      {routes(store)}
    </Router>
  </Provider>
);

ReactDOM.render(component, document.getElementById('react-view'));

if (process.env.NODE_ENV !== 'production') {
  ReactDOM.render(<DevTools store={store} />, document.getElementById('dev-tools'));
}

if (module.hot) {
  const hotEmitter = require('webpack/hot/emitter');
  const DEAD_CSS_TIMEOUT = 2000;

  hotEmitter.on('webpackHotUpdate', () => {
    document.querySelectorAll('link[href][rel=stylesheet]').forEach((link) => {
      const nextStyleHref = link.href.replace(/(\?\d+)?$/, `?${Date.now()}`);
      const newLink = link.cloneNode();

      newLink.href = nextStyleHref;

      link.parentNode.appendChild(newLink);
      setTimeout(() => {
        link.parentNode.removeChild(link);
      }, DEAD_CSS_TIMEOUT);
    });
  });
}