import express  from 'express';
import config from 'config';
import React    from 'react';
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

const staticVersion = '16';
const app = express();
const assetUrl = process.env.NODE_ENV !== 'production' ? 'https://flicktips.local:8050' : '';

app.use(cookieParser());

if (process.env.NODE_ENV !== 'productions') {
  app.use('/public', express.static(__dirname + '/../public'));
}

let isVkApp = false;

app.use((req, res) => {
  const store = configureStore();
  const referer = req.header('Referer');

  if (referer && referer.indexOf(config.vkAppUrl) === 0) {
    const {auth_key, viewer_id: user_id} = req.query;
    const auth_origin_url = 'https://' + req.get('host') + '/';

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
            const componentHTML = ReactDom.renderToString(
              <Provider store={store}>
                <RouterContext {...renderProps} />
              </Provider>
            );

            const state = store.getState();

            res.cookie('authHeaders', JSON.stringify(getHeaders(state)), {maxAge: 3600 * 24 * 30 * 1000});

            return res.end(renderHTML(componentHTML, state));
          })
          .catch(err => {
            console.log(err.stack);
            res.end(err.message);
          });
      })
    });
  }
});

function renderHTML(componentHTML, initialState) {
  return `
    <!DOCTYPE html>
      <html>
      <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, minimum-scale=1, user-scalable=no, minimal-ui">
          <link href="//fonts.googleapis.com/css?family=Open+Sans:300,400,400i,600,700&amp;subset=cyrillic" rel="stylesheet">
          <link rel="stylesheet" href="/public/icons/style.css${process.env.NODE_ENV !== 'production' ? `` : `?v=${staticVersion}`}">
          <link rel="stylesheet" href="${assetUrl}/public/assets/styles.css${process.env.NODE_ENV !== 'production' ? `` : `?v=${staticVersion}`}">
          <link rel="shortcut icon" href="/public/favicon.ico?3" type="image/x-icon" />
          <link rel="icon" href="/public/favicon.ico?3" type="image/x-icon">
          <script type="application/javascript">
            window.REDUX_INITIAL_STATE = ${JSON.stringify(initialState)};
            window.SERVER_TIMESTAMP = ${new Date().getTime()}
          </script>
      </head>
      <body>
        ${isVkApp ? `<script src="https://vk.com/js/api/xd_connection.js?2"  type="text/javascript"></script>` : ``}
        ${process.env.NODE_ENV !== 'production' ? `<div id="dev-tools"></div>` : ``}
        <div class="react-view" id="react-view">${componentHTML}</div>
        <script type="application/javascript" src="${assetUrl}/public/assets/bundle.js${process.env.NODE_ENV !== 'production' ? `` : `?v=${staticVersion}`}"></script>
        ${process.env.NODE_ENV !== 'production' ? `` : `<script type="text/javascript" >
    (function (d, w, c) {
        (w[c] = w[c] || []).push(function() {
            try {
                w.yaCounter45804789 = new Ya.Metrika({
                    id:45804789,
                    clickmap:true,
                    trackLinks:true,
                    accurateTrackBounce:true,
                    webvisor:true
                });
            } catch(e) { }
        });

        var n = d.getElementsByTagName("script")[0],
            s = d.createElement("script"),
            f = function () { n.parentNode.insertBefore(s, n); };
        s.type = "text/javascript";
        s.async = true;
        s.src = "https://mc.yandex.ru/metrika/watch.js";

        if (w.opera == "[object Opera]") {
            d.addEventListener("DOMContentLoaded", f, false);
        } else { f(); }
    })(document, window, "yandex_metrika_callbacks");
</script>
<noscript><div><img src="https://mc.yandex.ru/watch/45804789" style="position:absolute; left:-9999px;" alt="" /></div></noscript>
        <noscript><div><img src="https://mc.yandex.ru/watch/45804789" style="position:absolute; left:-9999px;" alt="" /></div></noscript>
        `}
      </body>
    </html>
  `;
}

const PORT = process.env.PORT || 3001;

if (process.env.NODE_ENV === 'production') {
  app.listen(PORT, () => {
    console.log(`Server listening on: ${PORT}`);
  });
} else {
  const httpsOptions = {
    key             : fs.readFileSync('./src/server.key').toString(),
    cert            : fs.readFileSync('./src/server.crt').toString(),
    passphrase      : '422673',
    ciphers         : 'ECDHE-RSA-AES256-GCM-SHA384:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-SHA:ECDHE-RSA-AES128-SHA256:ECDHE-RSA-AES256-SHA:ECDHE-RSA-AES256-SHA384',
    honorCipherOrder: true,
    secureProtocol  : 'TLSv1_2_method'
  };

  // https.createServer(httpsOptions, app).listen(PORT, () => {
  //   console.log(`Server listening on: ${PORT}`);
  // });
  http.createServer(app).listen(PORT, () => {
    console.log(`Server listening on: ${PORT}`);
  });
}

process.on('unhandledRejection', function (reason, p) {
  console.log('Unhandled Rejection:', reason.stack);
  process.exit(1);
});