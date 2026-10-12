import express from 'express';
import config from 'config';
import React from 'react';
import ReactDom from 'react-dom/server';
import {match, RouterContext} from 'react-router';
import routes from './routes';
import {Provider} from 'react-redux';
import configureStore from './redux/configureStore';
import cookieParser from 'cookie-parser';
import {getHeaders, initialize} from './partitions/redux-oauth';
import {loadOnServer} from 'redux-connect';
import http from 'http';
import fs from 'fs';
import Helmet from 'react-helmet';
import socketio from 'socket.io';
import cors from 'cors';

const hash = fs.readFileSync('./src/hash.txt').toString();
const app = express();
// ASSET_URL overrides the webpack-dev-server origin (empty = same origin, proxied by the local nginx)
const devAssetUrl = process.env.ASSET_URL !== undefined ? process.env.ASSET_URL : 'http://localhost:8050';
const assetUrl = process.env.NODE_ENV !== 'production' ? devAssetUrl : '';

app.use(cookieParser());
app.use(cors({credentials: true, origin: 'http://localhost:3001'}));

app.set('view engine', 'ejs');

if (process.env.NODE_ENV !== 'productions') {
  app.use('/public', express.static(__dirname + '/../public'));
}

app.use((req, res) => {
  const store = configureStore();
  const auth_token = req.query.auth_token;
  const uid = req.query.uid;
  let cookies = req.cookies;

  if (auth_token && uid) {
    cookies = Object.assign({}, cookies, {
      'authHeaders': JSON.stringify({
        'token-type'  : 'Bearer',
        'access-token': auth_token,
        'uid'         : uid
      })
    });
  }

  store.dispatch(initialize(Object.assign({}, config.oAuth, {
    currentLocation: req.url,
    cookies        : cookies
  }))).then(() => {
    match({routes: routes(store), location: req.url}, (error, redirectLocation, renderProps) => {
      if (redirectLocation) { // Если необходимо сделать redirect
        return res.redirect(301, redirectLocation.pathname + redirectLocation.search);
      }

      if (error) { // Произошла ошибка любого рода
        return res.status(500).send(error.message);
      }

      if (!renderProps) { // Мы не определили путь, который бы подошел для URL
        return res.status(404).send('Not found');
      }

      loadOnServer({...renderProps, store})
        .then(() => {
          const state = store.getState();

          if (state.app.get('notFound')) {
            return res.status(404).send('Not found');
          }

          const componentHTML = ReactDom.renderToString(
            <Provider store={store}>
              <RouterContext {...renderProps} />
            </Provider>
          );

          const helmet = Helmet.renderStatic();

          res.cookie('authHeaders', JSON.stringify(getHeaders(state)), {maxAge: 3600 * 24 * 30 * 1000});

          res.render('app', {
            assetUrl,
            initialState: state,
            componentHTML,
            hash,
            helmet
          });
          // return res.end(renderHTML(componentHTML, state));
        })
        .catch(err => {
          console.log(err.stack);
          res.end(err.message);
        });
    })
  });
});

const PORT = process.env.PORT || 3001;

let server;

server = http.createServer(app);

const io = socketio(server);

io.on('connection', function (socket) {
  socket.on('php-chanel-55e3a007b26c5adc2362edf6a50f18e6', function (params) {
    io.emit(params.chanel, params.data);
  });
});

server.listen(PORT, (process.env.NODE_ENV === 'production' ? 'localhost' : '0.0.0.0'), () => {
  console.log(`Server listening on: ${PORT}`);
});

process.on('unhandledRejection', function (reason, p) {
  console.log('Unhandled Rejection:', reason.stack);
  process.exit(1);
});