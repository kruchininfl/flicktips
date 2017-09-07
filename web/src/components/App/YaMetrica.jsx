import React, {Component} from 'react';
import NoScript from 'react-noscript';
import {browserHistory} from 'react-router';

class YaMetrica extends Component {
  componentDidMount() {
    if (process.env.NODE_ENV !== 'production') {
      return false;
    }

    const d = document;
    const w = window;
    const c = 'yandex_metrika_callbacks';

    (w[c] = w[c] || []).push(() => {
      try {
        w.yaCounter45804789 = new window.Ya.Metrika({
          id                 : 45804789,
          clickmap           : true,
          trackLinks         : true,
          accurateTrackBounce: true,
          webvisor           : true
        });

        browserHistory.listen(location => {
          if (w.yaCounter45804789) {
            w.yaCounter45804789.hit(location.pathname);
          }
        });
      } catch (e) {
        console.log(e);
      }
    });

    const n = d.getElementsByTagName('script')[0];
    const s = d.createElement('script');

    s.type = 'text/javascript';
    s.async = true;
    s.src = 'https://mc.yandex.ru/metrika/watch.js';

    if (w.opera === '[object Opera]') {
      d.addEventListener('DOMContentLoaded', () => n.parentNode.insertBefore(s, n), false);
    } else {
      n.parentNode.insertBefore(s, n);
    }
  }

  render() {
    if (process.env.NODE_ENV !== 'production') {
      return false;
    }

    return (
      <NoScript>
        <div><img src="https://mc.yandex.ru/watch/45804789" style={{position: 'absolute', left: '-9999px'}} alt="" />
        </div>
      </NoScript>
    );
  }
}

export default YaMetrica;