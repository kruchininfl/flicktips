import express from 'express';
import config from 'config';
import React from 'react';
import ReactDom from 'react-dom/server';
import {match, RouterContext} from 'react-router';
import routes from './routes';
import {Provider} from 'react-redux';
import configureStore from './redux/configureStore';
import cookieParser from 'cookie-parser';
import {getHeaders, initialize} from 'redux-oauth';
import {loadOnServer} from 'redux-connect';
import request from 'request';
import https from 'https';
import http from 'http';
import fs from 'fs';
import {setAsVkApp} from './redux/actions/appActions';
import Helmet from 'react-helmet';
import socketio from 'socket.io';
import cors from 'cors';

const hash = fs.readFileSync('./src/hash.txt').toString();
const app = express();
const assetUrl = process.env.NODE_ENV !== 'production' ? 'http://flicktips.local:8050' : '';

app.use(cookieParser());
app.use(cors({credentials: true, origin: 'http://flicktips.local:3001'}));

app.set('view engine', 'ejs');

if (process.env.NODE_ENV !== 'productions') {
  app.use('/public', express.static(__dirname + '/../public'));
}

let isVkApp = false;

app.use((req, res) => {
  const store = configureStore();
  const referer = req.header('Referer');

  if (referer && referer.indexOf(config.vkAppUrl) === 0) {
    const {auth_key, viewer_id: user_id} = req.query;
    const auth_origin_url = 'http://' + req.get('host') + '/';

    if (!auth_key || !user_id) {
      return res.redirect(301, '/');
    }

    const headers = {
      'Cookie': request.cookie('XDEBUG_SESSION=xdebug')
    };

    const options = {
      url      : config.oAuth.backend.apiUrl + '/api/app/authVk/',
      method   : 'GET',
      // headers: headers,
      jar      : true,
      strictSSL: false,
      qs       : {auth_key, user_id, auth_origin_url}
    };

    request(options, (e, response) => {
      isVkApp = true;
      return res.status(200).send(response.body);
    });
  } else {
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

      store.dispatch(setAsVkApp());
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
              isVkApp,
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
  }
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