import config from 'config';
import request from 'superagent';
import superagentJsonapify from 'superagent-jsonapify';
import keys from 'lodash/keys';
import assign from 'lodash/assign';
import Cookies from 'js-cookie';
import {openSignInPopup, setAsNotFound} from 'redux/actions/appActions';

function getTokenFormat(state) {
  const ret = {};

  state.auth.getIn(['config', 'tokenFormat']).forEach((value, key) => ret[key] = value);

  return ret;
}

function getCookieOptions(state) {
  return {
    key   : state.auth.getIn(['config', 'cookieOptions', 'key']),
    expire: state.auth.getIn(['config', 'cookieOptions', 'expire']),
    path  : state.auth.getIn(['config', 'cookieOptions', 'path'])
  };
}

function _getHeaders(state) {
  const tokenFormat = getTokenFormat(state);
  const ret = {};

  keys(tokenFormat).forEach(key => {
    const value = state.auth.getIn(['headers', key]);

    if (value) {
      ret[key] = value;
    }
  });

  return ret;
}

function areHeadersBlank(headers, tokenFormat) {
  if (!headers) {
    return true;
  }

  const allKeys = keys(tokenFormat);

  for (let i = 0; i < allKeys.length; ++i) {
    const key = allKeys[i];

    let value;

    if (headers[key] === undefined) {
      if (headers.has && headers.has(key)) {
        value = headers.get(key);
      } else {
        continue;
      }
    } else {
      value = headers[key];
    }

    if (value && value.toLowerCase() !== (tokenFormat[key] || '').toLocaleLowerCase()) {
      return false;
    }
  }

  return true;
}

function getHeaders(state) {
  if (!state || state === undefined) {
    return {};
  }

  const cookieOptions = getCookieOptions(state);
  const tokenFormat = getTokenFormat(state);
  const ret = _getHeaders(state);

  if (!areHeadersBlank(ret, tokenFormat)) {
    return ret;
  }

  try {
    return JSON.parse(Cookies.get(cookieOptions.key) || '{}');
  } catch (ex) {
    return {};
  }
}

function prepareHeadersForFetch(headers, tokenFormat) {
  const fetchHeaders = assign({}, headers, {'If-Modified-Since': 'Mon, 26 Jul 1997 05:00:00 GMT'});

  keys(tokenFormat).forEach(key => {
    const defaultValue = tokenFormat[key];

    if (defaultValue && !fetchHeaders[key]) {
      const evaluatedHeader = evalHeader(defaultValue, headers);

      if (evaluatedHeader) {
        fetchHeaders[key] = evaluatedHeader;
      }
    }
  });

  return fetchHeaders;
}

function evalHeader(expression, headers) {
  try {
    const preprocessed = expression.trim();

    if (preprocessed.length > 1 && preprocessed[0] === '{' && preprocessed[preprocessed.length - 1] === '}') {
      let ret = null;

      try {
        ret = preprocessed.substr(1, preprocessed.length - 2).replace(/\{(.*?)}/g, (...m) => {
          const header = headers[m[1].trim().toLowerCase()];

          if (!header) {
            throw 'not found';
          }

          return header;
        });
      } catch (ex) {
        return null;
      }

      return ret;
    }

    return expression;
  } catch (ex) {
    return null;
  }
}

superagentJsonapify(request);

export default {
  _fetch(url, data = {}, method = 'GET', skipAuthCheck = false, skipNotFoundCheck = false) {
    return (dispatch, getState) => {
      const state = getState();
      const {tokenFormat} = getTokenFormat(state);
      const headers = prepareHeadersForFetch(getHeaders(state), tokenFormat);

      const req = request[method.toLowerCase()](config.apiUrl + '/' + url)
        .set('Content-Type', 'application/json')
        .set(headers)
        .on('error', (err) => {
          if (err.status === 401 && !skipAuthCheck) {
            dispatch(openSignInPopup());
          }

          if (err.status === 404 && !skipNotFoundCheck) {
            dispatch(setAsNotFound());
          }
        });

      if (data) {
        if (method === 'GET') {
          req.query(data).send();
        } else {
          req.send(data);
        }
      }

      if (process.env.NODE_ENV === 'production') {
        req.withCredentials();
      }

      return req;
    };
  },

  search(query) {
    return this._fetch('search/' + query);
  },

  getTrends(page = 1) {
    return this._fetch('get_trends/', {page}, undefined, true);
  },

  getLastGraded(page = 1, onlyFriends = false) {
    return this._fetch(onlyFriends ? 'get_last_graded_films_friends/' : 'get_last_graded_films/', {page});
  },

  toggleVote(entityId, vote) {
    return this._fetch('user/vote/', {
      id: entityId,
      vote
    }, 'POST');
  },

  toggleBookmark(movieId) {
    return this._fetch('user/toggle_bookmark/', {movieId}, 'POST');
  },

  getUser(uid) {
    return this._fetch('user/' + uid);
  },

  getUserVotes(uid, page = 1) {
    return this._fetch('votes/user/' + uid, {page});
  },

  getUserFriends(page = 1) {
    return this._fetch('user/friends/', {page});
  },

  getUserBookmarks(page = 1) {
    return this._fetch('user/bookmarks/', {page});
  },

  toggleSubscribe(friendId) {
    return this._fetch('user/toggle_subscribe/', {friendId}, 'POST');
  },

  getFriendsVotes(page = 1) {
    return this._fetch('user/friends_votes/', {page}, undefined, true);
  },

  getMovie(id) {
    return this._fetch('get_film/' + id);
  },

  getPerson(id) {
    return this._fetch('get_person/' + id);
  }
};