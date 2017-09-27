// process.env['NODE_TLS_REJECT_UNAUTHORIZED'] = '0';

import Iconv from '../node_modules/iconv-lite';
import httpRequest from '../node_modules/request';
import cheerio from '../node_modules/cheerio';
import HttpsProxyAgent from '../node_modules/https-proxy-agent';
import stringSimilarity from '../node_modules/string-similarity';

String.prototype.dateFormat = function () {
  let str = this.length === 8 ? this : (this.length === 6 ? this + '00' : (this.length === 6 ? this + '0000' : null));
  if (str) {
    return str.replace(/(.{4})(.{2})(.{2})/, '$1-$2-$3');
  }

  return null;
};

// const PROXY_SERVICE = 'https://free-proxy-list.net/';
const PROXY_SERVICE = 'http://www.gatherproxy.com/proxylist/anonymity/?t=Transparent';
// const PROXY_SERVICE = 'http://gimmeproxy.com/api/getProxy?get=true&supportsHttps=true&maxCheckPeriod=3600&minSpeed=50&anonymityLevel&cookies=true';

const ENABLE_PROXY = false;
const ENABLE_LOG = false;

const REQUES_TIMEOUT = 15000;
let requestTimeout;

const j = httpRequest.jar();
const request = httpRequest.defaults({jar: j});

function log(msg) {
  if (!ENABLE_LOG) {
    return false;
  }
  console.log(msg);
}

function toUTF8(body) {
  return Iconv.decode(new Buffer(body, 'binary'), 'utf8');
}

function cpToUTF8(body) {
  return Iconv.encode(Iconv.decode(new Buffer(body, 'binary'), 'cp1251'), 'utf8').toString();
}

export function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

const requestDuration = 3000;
let proxies = [];
let currentProxy = null;
let lastRequestTime;

async function updateProxies() {
  proxies = [];
  return new Promise((resolve) => request({
    url     : PROXY_SERVICE,
    method  : 'GET',
    headers : {
      'Accept'                   : 'application/json',
      'Accept-Language'          : 'ru-RU,ru;q=0.8,en-US;q=0.6,en;q=0.4',
      'User-Agent'               : 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/59.0.3071.115 Safari/537.36',
      'Upgrade-Insecure-Requests': 1
    },
    encoding: 'binary'
  }, function (err, resp, body) {
    if (err) {
      return false;
    }

    if (/\/\/free-proxy-list\.net/.test(PROXY_SERVICE)) {
      const $ = cheerio.load(body);
      $('#proxylisttable tbody tr').each((i, tr) => {
        const $tds = cheerio.load(tr)('td');
        proxies.push(($tds.eq(6).text() === 'yes' ? 'https' : 'http') + '://' + $tds.eq(0).text() + ':' + $tds.eq(1).text());
      });
    }
    else if (/\/\/gimmeproxy\.com/.test(PROXY_SERVICE)) {
      proxies.push(JSON.parse(body).curl);
    }
    else if (/\/\/www\.gatherproxy\.com/.test(PROXY_SERVICE)) {
      const $ = cheerio.load(body);
      $('#tblproxy script').each((i, script) => {
        const $script = $(script);
        script = JSON.parse($script[0].children[0].data.match(/gp\.insertPrx\((.+?)\);/)[1]);
        proxies.push('http://' + script.PROXY_IP + ':' + parseInt(script.PROXY_PORT, 16));
      });
    }

    resolve(proxies);
  })).catch((err) => {
    throw err;
  });
}

async function getProxy() {
  if (!proxies.length) {
    await updateProxies();
  }

  return proxies.shift();
}

async function doRequest(opts) {
  if (lastRequestTime && (new Date().getTime() - lastRequestTime) < requestDuration) {
    const duration = requestDuration - (new Date().getTime() - lastRequestTime);
    await sleep(duration);
  }

  lastRequestTime = new Date().getTime();

  return new Promise((resolve) => {
    log('start request ' + opts.url);
    const req = request.get(opts, (err, res, body) => {
      log('finish request ' + opts.url);

      clearTimeout(requestTimeout);

      if (err !== null || res.statusCode !== 200) {
        resolve([err || new Error('response status code:' + res.statusCode), body]);
        return false;
      }

      if (res.headers['set-cookie']) {
        const cookies = res.headers['set-cookie'];
        cookies.forEach((c) => {
          const ac = c.split(';');
          j.setCookie(ac[0], ac[2].replace(' domain=', ''));
        });
      }

      if (res.headers['content-type'] !== 'application/json; charset=utf-8') {
        const $ = cheerio.load(toUTF8(body));
        const title = $('title').text();

        if (title === 'КиноПоиск.ru') {
          resolve([new Error('Proxy server ' + currentProxy + ' banned.'), body]);
          return false;
        }
      }

      resolve([null, body]);
    }).on('abort', () => resolve([new Error(currentProxy + ' : connection timeout'), null]));

    clearTimeout(requestTimeout);
    requestTimeout = setTimeout(req.abort.bind(req), REQUES_TIMEOUT);
  }).catch((err) => {
    throw err;
  });
}

async function requestGet(url, headers = {}) {
  let args = arguments;

  if (ENABLE_PROXY) {
    currentProxy = currentProxy || await getProxy();
  }

  const [error, body] = await doRequest({
    url           : url,
    agent         : ENABLE_PROXY ? new HttpsProxyAgent(currentProxy) : null,
    headers       : Object.assign({'Connection': 'keep-alive'}, headers),
    timeout       : 5000,
    followRedirect: true,
    // maxRedirects: 1,
    encoding      : 'binary',
  });

  if (error) {
    console.log(error.message);
    currentProxy = null;
    return await requestGet.apply(this, args);
  }

  return body;
}

async function search(query, querySecond, year, type, minStringSimilarityK = 0) {
  // return Promise.resolve(4541);

  const body = await requestGet('https://www.kinopoisk.ru/search/suggest/?value=' + encodeURI(query), {
    'Accept'          : 'application/json',
    'Content-Type'    : 'application/json',
    'x-requested-with': 'XMLHttpRequest',
    'User-Agent'      : 'Mozilla/5.0 (iPhone; CPU iPhone OS 9_1 like Mac OS X) AppleWebKit/601.1.46 (KHTML, like Gecko) Version/9.0 Mobile/13B143 Safari/601.1'
  });

  const result = JSON.parse(toUTF8(body));

  let id = null;
  let similarity = 0;

  if (result.page.suggest && result.page.suggest.items && result.page.suggest.items.movies && result.page.suggest.items.movies.length) {
    result.page.suggest.items.movies.some((movie) => {
      const stringSimilarityK = stringSimilarity.compareTwoStrings(movie.originalTitle, query);

      if (
        (type === 'tv' && !/\(сериал\)$/.test(movie.displayTitle))
        || minStringSimilarityK > stringSimilarityK
      ) {
        return false;
      }

      if (movie.year && Math.abs(movie.year.replace(/\-(.*)/, '') - year) <= 1) {
        id = movie.id;
        similarity = stringSimilarityK;
        return true;
      }
    });
  }

  if (id === null && querySecond) {
    return await search(querySecond, null, year, type, minStringSimilarityK);
  }

  return {id, similarity};
}

async function getFilm(id) {
  // return Promise.resolve({ 'id'            : 4541, 'title'         : 'Шоу Трумана', 'original_title': 'The Truman Show', 'year'          : 1998, 'countries'     : [{'name': 'США', 'id': 1}], 'genres'        : [{'name': 'фантастика', 'id': 2}, {'name': 'драма', 'id': 8}, { 'name': 'комедия', 'id': 6}], 'release_date'  : '1998-06-01', 'release_rus'   : '1998-10-00', 'release_dvd'   : '2009-12-15', 'duration'      : '103', 'kp_rating'     : {'value': 8.3, 'count': 242024}, 'imdb_rating'   : {'value': 8.1, 'count': 721710}, 'description'   : 'Представьте себе, что вы вдруг начинаете понимать, что все вокруг вас — декорации, а люди — актеры, притворяющиеся теми, кем они вам кажутся. Весь ваш мир оказывается большим телесериалом, где вы исполняете главную роль, даже не подозревая об этом. Вся ваша жизнь — результат работы автора телешоу, которое вот уже тридцать лет смотрит вся планета, начиная с момента вашего рождения. В такой ситуации оказался Труман, главный герой картины. Будет ли он продолжать жить в безопасном мире, где, как он теперь знает, у него практически нет свободы выбора, или все-таки выйдет из «игры» и станет сам хозяином своей судьбы, в которой его ждет не запланированная сценарием девушка?'});

  const body = await requestGet('https://www.kinopoisk.ru/film/' + id + '/?v=' + new Date().getTime(), {
    'Content-Type': 'text/html; charset=windows-1251',
    'Accept'      : 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
    'User-Agent'  : 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/59.0.3071.115 Safari/537.36',
  });

  const $ = cheerio.load(cpToUTF8(body));
  let film = {
    id,
    title         : null,
    original_title: null,
    year          : null,
    start_year    : null,
    finish_year   : null,
    countries     : [],
    genres        : [],
    release_date  : null,
    release_rus   : null,
    release_dvd   : null,
    duration      : null,
    kp_rating     : {},
    imdb_rating   : {},
    description   : null
  };

  const $years = $('h1[itemprop=name] span');

  if ($years.length) {
    const yearsMatch = $years.text().match(/\(сериал (.+?)\s–\s(.+?)\)$/);
    if (yearsMatch) {
      film.start_year = +yearsMatch[1];
      film.finish_year = yearsMatch[2] === '...' ? null : +yearsMatch[2];
    }
  }

  $years.remove();
  film.title = $('h1[itemprop=name]').remove('span').text().trim() || null;

  film.original_title = $('span[itemprop=alternativeHeadline]').text() || null;

  film.year = +$('a[href^="/lists/m_act%5Byear%5D/"]').text() || null;

  $('.movieFlags').remove();

  const $countries = $('a[href^="/lists/m_act%5Bcountry%5D/"]');
  if ($countries.length) {
    $countries.each((i, el) => {
      const $el = $(el);
      film.countries.push({
        name: $el.text() || 'Unknown',
        id  : +$el.attr('href').match(/\/lists\/m_act%5Bcountry%5D\/(.+?)\//)[1]
      })
    });
  }

  const $genres = $('a[href^="/lists/m_act%5Bgenre%5D/"]');
  if ($genres.length) {
    $genres.each((i, el) => {
      const $el = $(el);
      film.genres.push({
        name: $el.text() || 'Unknown',
        id  : +$el.attr('href').match(/\/lists\/m_act%5Bgenre%5D\/(.+?)\//)[1]
      })
    });
  }

  const releaseDate = $('#div_world_prem_td2 [data-date-premier-start-link]').attr('data-date-premier-start-link');
  film.release_date = releaseDate ? releaseDate.dateFormat() : null;

  const releaseRus = $('#div_rus_prem_td2 [data-date-premier-start-link]').attr('data-date-premier-start-link');
  film.release_rus = releaseRus ? releaseRus.dateFormat() : null;

  const releaseDvd = $('.calendar.dvd [data-date-premier-start-link]').attr('data-date-premier-start-link');
  film.release_dvd = releaseDvd ? releaseDvd.dateFormat() : null;

  const duration = $('#runtime').text().match(/(.+?)\sмин./);
  film.duration = duration ? +duration[1] : null;

  const ratingValue = $('meta[itemprop=ratingValue]').attr('content');
  const ratingCount = $('meta[itemprop=ratingCount]').attr('content');
  if (ratingValue) {
    film.kp_rating = {
      value: +ratingValue,
      count: +ratingCount
    }
  }

  const imdbString = $('[style="color:#999;font:100 11px tahoma, verdana"]').text();
  if (imdbString) {
    const imdbMatches = imdbString.match(/IMDb: (.+?)\s\((.+?)\)/);
    film.imdb_rating = {
      value: +imdbMatches[1],
      count: +imdbMatches[2].replace(/\s/g, '')
    }
  }

  film.description = $('div[itemprop=description]').text() || null;

  return film;
}

async function getFilmStaff(id, page = 1, staff = []) {

  // return Promise.resolve([{"id":63414,"name":"Питер Уир","originalName":"Peter Weir","displayName":"Питер Уир","img":"//st.kp.yandex.net/images/actor_iphone/iphone_63414.jpg?d=20130318151359&width=360","group":{"type":"director","title":"Режиссеры"},"isInFolder":false},{"id":6141,"name":"Джим Керри","originalName":"Jim Carrey","displayName":"Джим Керри","description":"Truman Burbank","img":"//st.kp.yandex.net/images/actor_iphone/iphone_6141.jpg?d=20150222145955&width=360","group":{"type":"actor","title":"Актеры"},"isInFolder":false},{"id":10965,"name":"Лора Линни","originalName":"Laura Linney","displayName":"Лора Линни","description":"Meryl Burbank / Hannah Gill","img":"//st.kp.yandex.net/images/actor_iphone/iphone_10965.jpg?width=360","group":{"type":"actor","title":"Актеры"},"isInFolder":false},{"id":24435,"name":"Ноа Эммерих","originalName":"Noah Emmerich","displayName":"Ноа Эммерих","description":"Marlon","img":"//st.kp.yandex.net/images/actor_iphone/iphone_24435.jpg?width=360","group":{"type":"actor","title":"Актеры"},"isInFolder":false},{"id":1323,"name":"Наташа МакЭлхоун","originalName":"Natascha McElhone","displayName":"Наташа МакЭлхоун","description":"Lauren / Sylvia","img":"//st.kp.yandex.net/images/actor_iphone/iphone_1323.jpg?d=20131113170457&width=360","group":{"type":"actor","title":"Актеры"},"isInFolder":false},{"id":7888,"name":"Эд Харрис","originalName":"Ed Harris","displayName":"Эд Харрис","description":"Christof","img":"//st.kp.yandex.net/images/actor_iphone/iphone_7888.jpg?d=20131008130839&width=360","group":{"type":"actor","title":"Актеры"},"isInFolder":false},{"id":11733,"name":"Холланд Тейлор","originalName":"Holland Taylor","displayName":"Холланд Тейлор","description":"Truman's Mother","img":"//st.kp.yandex.net/images/actor_iphone/iphone_11733.jpg?width=360","group":{"type":"actor","title":"Актеры"},"isInFolder":false},{"id":3470,"name":"Брайан Дилейт","originalName":"Brian Delate","displayName":"Брайан Дилейт","description":"Truman's Father","img":"//st.kp.yandex.net/images/actor_iphone/iphone_3470.jpg?width=360","group":{"type":"actor","title":"Актеры"},"isInFolder":false},{"id":12591,"name":"Пол Джаматти","originalName":"Paul Giamatti","displayName":"Пол Джаматти","description":"Control Room Director","img":"//st.kp.yandex.net/images/actor_iphone/iphone_12591.jpg?width=360","group":{"type":"actor","title":"Актеры"},"isInFolder":false},{"id":3654,"name":"Гарри Ширер","originalName":"Harry Shearer","displayName":"Гарри Ширер","description":"Mike Michaelson","img":"//st.kp.yandex.net/images/actor_iphone/iphone_3654.jpg?width=360","group":{"type":"actor","title":"Актеры"},"isInFolder":false},{"id":3101,"name":"Филип Бейкер Холл","originalName":"Philip Baker Hall","displayName":"Филип Бейкер Холл","description":"Network Executive","img":"//st.kp.yandex.net/images/actor_iphone/iphone_3101.jpg?d=20130910131438&width=360","group":{"type":"actor","title":"Актеры"},"isInFolder":false},{"id":10653,"name":"Блэр Слэйтер","originalName":"Blair Slater","displayName":"Блэр Слэйтер","description":"Young Truman","img":"//st.kp.yandex.net/images/actor_iphone/iphone_10653.jpg?d=20161204212609&width=360","group":{"type":"actor","title":"Актеры"},"isInFolder":false},{"id":63415,"name":"Питер Краузе","originalName":"Peter Krause","displayName":"Питер Краузе","description":"Lawrence","img":"//st.kp.yandex.net/images/actor_iphone/iphone_63415.jpg?d=20130314184128&width=360","group":{"type":"actor","title":"Актеры"},"isInFolder":false},{"id":1872,"name":"Хайди Шанц","originalName":"Heidi Schanz","displayName":"Хайди Шанц","description":"Vivien","img":"//st.kp.yandex.net/images/actor_iphone/iphone_1872.jpg?width=360","group":{"type":"actor","title":"Актеры"},"isInFolder":false},{"id":63416,"name":"Рон Тейлор","originalName":"Ron Taylor","displayName":"Рон Тейлор","description":"Ron","img":null,"group":{"type":"actor","title":"Актеры"},"isInFolder":false},{"id":63417,"name":"Дон Тейлор","originalName":"Don Taylor","displayName":"Дон Тейлор","description":"Don","img":null,"group":{"type":"actor","title":"Актеры"},"isInFolder":false},{"id":63418,"name":"Тед Рэймонд","originalName":"Ted Raymond","displayName":"Тед Рэймонд","description":"Spencer","img":"//st.kp.yandex.net/images/actor_iphone/iphone_63418.jpg?d=20150830182044&width=360","group":{"type":"actor","title":"Актеры"},"isInFolder":false},{"id":52194,"name":"Джуди Клэйтон","originalName":"Judy Clayton","displayName":"Джуди Клэйтон","description":"Travel Agent","img":"//st.kp.yandex.net/images/actor_iphone/iphone_52194.jpg?width=360","group":{"type":"actor","title":"Актеры"},"isInFolder":false},{"id":63419,"name":"Фриц Доминик","originalName":"Fritz Dominique","displayName":"Фриц Доминик","description":"Truman's Neighbor","img":"//st.kp.yandex.net/images/actor_iphone/iphone_63419.jpg?d=20160224114330&width=360","group":{"type":"actor","title":"Актеры"},"isInFolder":false},{"id":63420,"name":"Энджел Шмийдт","originalName":"Angel Schmiedt","displayName":"Энджел Шмийдт","description":"Truman's Neighbor","img":"//st.kp.yandex.net/images/actor_iphone/iphone_63420.jpg?width=360","group":{"type":"actor","title":"Актеры"},"isInFolder":false},{"id":63421,"name":"Настасия Шмийдт","originalName":"Nastassja Schmiedt","displayName":"Настасия Шмийдт","description":"Truman's Neighbor","img":null,"group":{"type":"actor","title":"Актеры"},"isInFolder":false},{"id":63422,"name":"Мюриэль Мур","originalName":"Muriel Moore","displayName":"Мюриэль Мур","description":"Teacher","img":null,"group":{"type":"actor","title":"Актеры"},"isInFolder":false},{"id":8596,"name":"Мэл Джонс","originalName":"Mal Jones","displayName":"Мэл Джонс","description":"News Vendor","img":null,"group":{"type":"actor","title":"Актеры"},"isInFolder":false},{"id":63423,"name":"Джадсон Вон","originalName":"Judson Vaughn","displayName":"Джадсон Вон","description":"Insurance Co-Worker","img":"//st.kp.yandex.net/images/actor_iphone/iphone_63423.jpg?width=360","group":{"type":"actor","title":"Актеры"},"isInFolder":false},{"id":63424,"name":"Эрл Хиллиард мл.","originalName":"Earl Hilliard Jr.","displayName":"Эрл Хиллиард мл.","description":"Ferry Worker","img":null,"group":{"type":"actor","title":"Актеры"},"isInFolder":false},{"id":63425,"name":"Дэвид Эндрю Нэш","originalName":"David Andrew Nash","displayName":"Дэвид Эндрю Нэш","description":"Bus Driver / Ferry Captain","img":"//st.kp.yandex.net/images/actor_iphone/iphone_63425.jpg?width=360","group":{"type":"actor","title":"Актеры"},"isInFolder":false},{"id":63426,"name":"Джим Тауэрс","originalName":"Jim Towers","displayName":"Джим Тауэрс","description":"Bus Supervisor","img":null,"group":{"type":"actor","title":"Актеры"},"isInFolder":false},{"id":63427,"name":"Саванна Своффорд","originalName":"Savannah Swafford","displayName":"Саванна Своффорд","description":"Little Girl in Bus","img":null,"group":{"type":"actor","title":"Актеры"},"isInFolder":false},{"id":29666,"name":"Энтони Короне","originalName":"Antoni Corone","displayName":"Энтони Короне","description":"Security Guard","img":"//st.kp.yandex.net/images/actor_iphone/iphone_29666.jpg?width=360","group":{"type":"actor","title":"Актеры"},"isInFolder":false},{"id":56424,"name":"Марио Эрнесто Санчес","originalName":"Mario Ernesto Sánchez","displayName":"Марио Эрнесто Санчес","description":"Security Guard (в титрах: Mario Ernesto Sanchez)","img":"//st.kp.yandex.net/images/actor_iphone/iphone_56424.jpg?width=360","group":{"type":"actor","title":"Актеры"},"isInFolder":false},{"id":23023,"name":"Джон Роселиус","originalName":"John Roselius","displayName":"Джон Роселиус","description":"Man at Beach","img":null,"group":{"type":"actor","title":"Актеры"},"isInFolder":false},{"id":63428,"name":"Кэйд Коутс","originalName":"Kade Coates","displayName":"Кэйд Коутс","description":"Truman (4 years)","img":"//st.kp.yandex.net/images/actor_iphone/iphone_63428.jpg?width=360","group":{"type":"actor","title":"Актеры"},"isInFolder":false},{"id":28263,"name":"Марсия ДеБонис","originalName":"Marcia DeBonis","displayName":"Марсия ДеБонис","description":"Nurse","img":"//st.kp.yandex.net/images/actor_iphone/iphone_28263.jpg?width=360","group":{"type":"actor","title":"Актеры"},"isInFolder":false},{"id":63429,"name":"Сэм Китчин","originalName":"Sam Kitchin","displayName":"Сэм Китчин","description":"Surgeon","img":"//st.kp.yandex.net/images/actor_iphone/iphone_63429.jpg?width=360","group":{"type":"actor","title":"Актеры"},"isInFolder":false},{"id":63430,"name":"Себастьян Янблад","originalName":"Sebastian Youngblood","displayName":"Себастьян Янблад","description":"Orderly","img":null,"group":{"type":"actor","title":"Актеры"},"isInFolder":false},{"id":26128,"name":"Дэйв Кори","originalName":"Dave Corey","displayName":"Дэйв Кори","description":"Hospital Security Guard","img":"//st.kp.yandex.net/images/actor_iphone/iphone_26128.jpg?width=360","group":{"type":"actor","title":"Актеры"},"isInFolder":false},{"id":63431,"name":"Марк Алан Гиллотт","originalName":"Mark Alan Gillott","displayName":"Марк Алан Гиллотт","description":"Policeman at Power Plant","img":null,"group":{"type":"actor","title":"Актеры"},"isInFolder":false},{"id":63432,"name":"Джей Сейтер","originalName":"Jay Saiter","displayName":"Джей Сейтер","description":"Policeman at Truman's House","img":null,"group":{"type":"actor","title":"Актеры"},"isInFolder":false},{"id":63433,"name":"Тони Тодд","originalName":"Tony Todd","displayName":"Тони Тодд","description":"Policeman at Truman's House","img":null,"group":{"type":"actor","title":"Актеры"},"isInFolder":false},{"id":63434,"name":"Марко Рубео","originalName":"Marco Rubeo","displayName":"Марко Рубео","description":"Man in Christmas Box","img":null,"group":{"type":"actor","title":"Актеры"},"isInFolder":false},{"id":63435,"name":"Дэррил Дэвис","originalName":"Daryl Davis","displayName":"Дэррил Дэвис","description":"Couple at Picnic Table (в титрах: Darryl Davis)","img":null,"group":{"type":"actor","title":"Актеры"},"isInFolder":false},{"id":63436,"name":"Роберт Дэвис","originalName":"Robert Davis","displayName":"Роберт Дэвис","description":"Couple at Picnic Table","img":null,"group":{"type":"actor","title":"Актеры"},"isInFolder":false},{"id":63437,"name":"Р.Дж. Мёрдок","originalName":"R.J. Murdock","displayName":"Р.Дж. Мёрдок","description":"Production Assistant","img":null,"group":{"type":"actor","title":"Актеры"},"isInFolder":false},{"id":63438,"name":"Мэттью МакДонаф","originalName":"Matthew McDonough","displayName":"Мэттью МакДонаф","description":"Man at Newsstand","img":null,"group":{"type":"actor","title":"Актеры"},"isInFolder":false},{"id":63439,"name":"Ларри Макдауэлл","originalName":"Larry McDowell","displayName":"Ларри Макдауэлл","description":"Man at Newsstand","img":null,"group":{"type":"actor","title":"Актеры"},"isInFolder":false},{"id":63440,"name":"Джозеф Лукус","originalName":"Joseph Lucus","displayName":"Джозеф Лукус","description":"Ticket Taker","img":null,"group":{"type":"actor","title":"Актеры"},"isInFolder":false},{"id":63441,"name":"Логан Киркси","originalName":"Logan Kirksey","displayName":"Логан Киркси","description":"TV Host","img":null,"group":{"type":"actor","title":"Актеры"},"isInFolder":false},{"id":9061,"name":"Адам Томей","originalName":"Adam Tomei","displayName":"Адам Томей","description":"Control Room Director","img":"//st.kp.yandex.net/images/actor_iphone/iphone_9061.jpg?width=360","group":{"type":"actor","title":"Актеры"},"isInFolder":false},{"id":2954,"name":"Уна Дэймон","originalName":"Una Damon","displayName":"Уна Дэймон","description":"Chloe","img":"//st.kp.yandex.net/images/actor_iphone/iphone_2954.jpg?width=360","group":{"type":"actor","title":"Актеры"},"isInFolder":false},{"id":63442,"name":"Джон Плешетт","originalName":"John Pleshette","displayName":"Джон Плешетт","description":"Network Executive","img":"//st.kp.yandex.net/images/actor_iphone/iphone_63442.jpg?d=20150829120408&width=360","group":{"type":"actor","title":"Актеры"},"isInFolder":false},{"id":63443,"name":"Филип Гласс","originalName":"Philip Glass","displayName":"Филип Гласс","description":"Keyboard Artist","img":"//st.kp.yandex.net/images/actor_iphone/iphone_63443.jpg?width=360","group":{"type":"actor","title":"Актеры"},"isInFolder":false},{"id":63444,"name":"Джон Прамик","originalName":"John Pramik","displayName":"Джон Прамик","description":"Keyboard Artist","img":null,"group":{"type":"actor","title":"Актеры"},"isInFolder":false},{"id":10586,"name":"О-Лан Джонс","originalName":"O-Lan Jones","displayName":"О-Лан Джонс","description":"Bar Waitress","img":"//st.kp.yandex.net/images/actor_iphone/iphone_10586.jpg?width=360","group":{"type":"actor","title":"Актеры"},"isInFolder":false},{"id":63445,"name":"Криста Линн Лэндолфи","originalName":"Krista Lynn Landolfi","displayName":"Криста Линн Лэндолфи","description":"Bar Waitress","img":null,"group":{"type":"actor","title":"Актеры"},"isInFolder":false},{"id":63446,"name":"Джо Миньярес","originalName":"Joe Minjares","displayName":"Джо Миньярес","description":"Bartender","img":"//st.kp.yandex.net/images/actor_iphone/iphone_63446.jpg?width=360","group":{"type":"actor","title":"Актеры"},"isInFolder":false},{"id":8299,"name":"Аль Фостер","originalName":"Al Foster","displayName":"Аль Фостер","description":"Bar Patron","img":"//st.kp.yandex.net/images/actor_iphone/iphone_8299.jpg?d=20150823182420&width=360","group":{"type":"actor","title":"Актеры"},"isInFolder":false},{"id":63447,"name":"Зуанн Лерой","originalName":"Zoaunne LeRoy","displayName":"Зуанн Лерой","description":"Bar Patron","img":"//st.kp.yandex.net/images/actor_iphone/iphone_63447.jpg?d=20150706202239&width=360","group":{"type":"actor","title":"Актеры"},"isInFolder":false},{"id":16630,"name":"Милли Слэвин","originalName":"Millie Slavin","displayName":"Милли Слэвин","description":"Bar Patron","img":"//st.kp.yandex.net/images/actor_iphone/iphone_16630.jpg?width=360","group":{"type":"actor","title":"Актеры"},"isInFolder":false},{"id":29793,"name":"Терри Камиллери","originalName":"Terry Camilleri","displayName":"Терри Камиллери","description":"Man in Bathtub","img":"//st.kp.yandex.net/images/actor_iphone/iphone_29793.jpg?width=360","group":{"type":"actor","title":"Актеры"},"isInFolder":false},{"id":6777,"name":"Донна Харди","originalName":"Dona Hardy","displayName":"Донна Харди","description":"Senior Citizen","img":null,"group":{"type":"actor","title":"Актеры"},"isInFolder":false},{"id":22634,"name":"Жанетт Миллер","originalName":"Jeanette Miller","displayName":"Жанетт Миллер","description":"Senior Citizen","img":"//st.kp.yandex.net/images/actor_iphone/iphone_22634.jpg?width=360","group":{"type":"actor","title":"Актеры"},"isInFolder":false},{"id":1960298,"name":"Джоэль МакКиннон Миллер","originalName":"Joel McKinnon Miller","displayName":"Джоэль МакКиннон Миллер","description":"Garage Attendant","img":"//st.kp.yandex.net/images/actor_iphone/iphone_1960298.jpg?width=360","group":{"type":"actor","title":"Актеры"},"isInFolder":false},{"id":57744,"name":"Том Симмонс","originalName":"Tom Simmons","displayName":"Том Симмонс","description":"Garage Attendant","img":"//st.kp.yandex.net/images/actor_iphone/iphone_57744.jpg?width=360","group":{"type":"actor","title":"Актеры"},"isInFolder":false},{"id":63448,"name":"Сьюзэн Анджело","originalName":"Susan Angelo","displayName":"Сьюзэн Анджело","description":"Mother","img":"//st.kp.yandex.net/images/actor_iphone/iphone_63448.jpg?width=360","group":{"type":"actor","title":"Актеры"},"isInFolder":false},{"id":63449,"name":"Карли Смига","originalName":"Carly Smiga","displayName":"Карли Смига","description":"Daughter","img":null,"group":{"type":"actor","title":"Актеры"},"isInFolder":false},{"id":16414,"name":"Юдзи Окумото","originalName":"Yuji Okumoto","displayName":"Юдзи Окумото","description":"Japanese Family","img":"//st.kp.yandex.net/images/actor_iphone/iphone_16414.jpg?d=20141111150300&width=360","group":{"type":"actor","title":"Актеры"},"isInFolder":false},{"id":26999,"name":"Киёко Ямагути","originalName":"Kiyoko Yamaguchi","displayName":"Киёко Ямагути","description":"Japanese Family","img":null,"group":{"type":"actor","title":"Актеры"},"isInFolder":false},{"id":29373,"name":"Саеми Накамура","originalName":"Saemi Nakamura","displayName":"Саеми Накамура","description":"Japanese Family","img":"//st.kp.yandex.net/images/actor_iphone/iphone_29373.jpg?width=360","group":{"type":"actor","title":"Актеры"},"isInFolder":false},{"id":475986,"name":"Джэйк Эберли","originalName":"Jake Eberle","displayName":"Джэйк Эберли","description":"Classical Clive, в титрах не указан","img":"//st.kp.yandex.net/images/actor_iphone/iphone_475986.jpg?width=360","group":{"type":"actor","title":"Актеры"},"isInFolder":false},{"id":602466,"name":"Мелисса Фицджералд","originalName":"Melissa Fitzgerald","displayName":"Мелисса Фицджералд","description":"Girl Dancing with Marlon, в титрах не указан","img":"//st.kp.yandex.net/images/actor_iphone/iphone_602466.jpg?width=360","group":{"type":"actor","title":"Актеры"},"isInFolder":false},{"id":456211,"name":"Сержиу Като","originalName":"Sergio Kato","displayName":"Сержиу Като","description":"Production Assistant, в титрах не указан","img":"//st.kp.yandex.net/images/actor_iphone/iphone_456211.jpg?d=20150802223821&width=360","group":{"type":"actor","title":"Актеры"},"isInFolder":false},{"id":8579,"name":"Марк Маколей","originalName":"Marc Macaulay","displayName":"Марк Маколей","description":"в титрах не указан","img":"//st.kp.yandex.net/images/actor_iphone/iphone_8579.jpg?width=360","group":{"type":"actor","title":"Актеры"},"isInFolder":false},{"id":177708,"name":"Майкл Дж. МакАлистер","originalName":"Michael J. McAlister","displayName":"Майкл Дж. МакАлистер","description":"Man closing door on OmniCam Ecosphere Dome, в титрах не указан","img":null,"group":{"type":"actor","title":"Актеры"},"isInFolder":false},{"id":225167,"name":"Микалин МакКормик","originalName":"Mickalean McCormick","displayName":"Микалин МакКормик","description":"Assistant to Christof, в титрах не указан","img":"//st.kp.yandex.net/images/actor_iphone/iphone_225167.jpg?width=360","group":{"type":"actor","title":"Актеры"},"isInFolder":false},{"id":657295,"name":"Лорин Мур","originalName":"Lorin Moore","displayName":"Лорин Мур","description":"Ticket Handler, в титрах не указан","img":null,"group":{"type":"actor","title":"Актеры"},"isInFolder":false},{"id":914140,"name":"Кортни Пакиз","originalName":"Courtney Pakiz","displayName":"Кортни Пакиз","description":"German linguist / interpreter, в титрах не указан","img":null,"group":{"type":"actor","title":"Актеры"},"isInFolder":false},{"id":63450,"name":"Кевин Д. Росс","originalName":"Kevin D. Ross","displayName":"Кевин Д. Росс","description":"Talk Show Caller, озвучка, в титрах не указан","img":null,"group":{"type":"actor","title":"Актеры"},"isInFolder":false},{"id":239835,"name":"Эрика Тейлор","originalName":"Erica Taylor","displayName":"Эрика Тейлор","description":"Prom Guest, в титрах не указан","img":"//st.kp.yandex.net/images/actor_iphone/iphone_239835.jpg?width=360","group":{"type":"actor","title":"Актеры"},"isInFolder":false},{"id":10847,"name":"Эдвард С. Фельдман","originalName":"Edward S. Feldman","displayName":"Эдвард С. Фельдман","img":"//st.kp.yandex.net/images/actor_iphone/iphone_10847.jpg?width=360","group":{"type":"producer","title":"Продюсеры"},"isInFolder":false},{"id":37187,"name":"Эндрю Никкол","originalName":"Andrew Niccol","displayName":"Эндрю Никкол","img":null,"group":{"type":"writer","title":"Сценаристы"},"isInFolder":false},{"id":7217,"name":"Скотт Рудин","originalName":"Scott Rudin","displayName":"Скотт Рудин","img":"//st.kp.yandex.net/images/actor_iphone/iphone_7217.jpg?width=360","group":{"type":"producer","title":"Продюсеры"},"isInFolder":false},{"id":7219,"name":"Адам Шредер","originalName":"Adam Schroeder","displayName":"Адам Шредер","img":"//st.kp.yandex.net/images/actor_iphone/iphone_7219.jpg?d=20170320140640&width=360","group":{"type":"producer","title":"Продюсеры"},"isInFolder":false},{"id":63451,"name":"Линн Плешетт","originalName":"Lynn Pleshette","displayName":"Линн Плешетт","description":"исполнительный продюсер","img":"//st.kp.yandex.net/images/actor_iphone/iphone_63451.jpg?width=360","group":{"type":"producer","title":"Продюсеры"},"isInFolder":false},{"id":10014,"name":"Ричард Люк Ротшилд","originalName":"Richard Luke Rothschild","displayName":"Ричард Люк Ротшилд","description":"сопродюсер","img":null,"group":{"type":"producer","title":"Продюсеры"},"isInFolder":false},{"id":2431317,"name":"Павел Силенчук","originalName":"","displayName":"Павел Силенчук","img":"//st.kp.yandex.net/images/actor_iphone/iphone_2431317.jpg?d=20161003121946&width=360","group":{"type":"translator","title":"Переводчики"},"isInFolder":false},{"id":37187,"name":"Эндрю Никкол","originalName":"Andrew Niccol","displayName":"Эндрю Никкол","img":null,"group":{"type":"writer","title":"Сценаристы"},"isInFolder":false},{"id":329316,"name":"Питер Бижу","originalName":"Peter Biziou","displayName":"Питер Бижу","img":"//st.kp.yandex.net/images/actor_iphone/iphone_329316.jpg?width=360","group":{"type":"operator","title":"Операторы"},"isInFolder":false},{"id":615088,"name":"Буркхард фон Далльвиц","originalName":"Burkhard von Dallwitz","displayName":"Буркхард фон Далльвиц","img":"//st.kp.yandex.net/images/actor_iphone/iphone_615088.jpg?width=360","group":{"type":"composer","title":"Композиторы"},"isInFolder":false},{"id":1529291,"name":"Деннис Гасснер","originalName":"Dennis Gassner","displayName":"Деннис Гасснер","description":"постановщик","img":"//st.kp.yandex.net/images/actor_iphone/iphone_1529291.jpg?width=360","group":{"type":"design","title":"Художники"},"isInFolder":false},{"id":3547633,"name":"Ричард Л. Джонсон","originalName":"Richard L. Johnson","displayName":"Ричард Л. Джонсон","img":null,"group":{"type":"design","title":"Художники"},"isInFolder":false},{"id":1996396,"name":"Мэрлин Мэтьюз","originalName":"Marilyn Matthews","displayName":"Мэрлин Мэтьюз","description":"по костюмам","img":null,"group":{"type":"design","title":"Художники"},"isInFolder":false},{"id":1997365,"name":"Нэнси Хэй","originalName":"Nancy Haigh","displayName":"Нэнси Хэй","description":"по декорациям","img":null,"group":{"type":"design","title":"Художники"},"isInFolder":false},{"id":2771851,"name":"","originalName":"J Sanchez","displayName":"J Sanchez","description":"по декорациям","img":null,"group":{"type":"design","title":"Художники"},"isInFolder":false},{"id":998096,"name":"Уильям М. Андерсон","originalName":"William M. Anderson","displayName":"Уильям М. Андерсон","img":null,"group":{"type":"editor","title":"Монтажеры"},"isInFolder":false},{"id":2354627,"name":"Ли Смит","originalName":"Lee Smith","displayName":"Ли Смит","img":"//st.kp.yandex.net/images/actor_iphone/iphone_2354627.jpg?width=360","group":{"type":"editor","title":"Монтажеры"},"isInFolder":false}]);

  const body = await requestGet('https://www.kinopoisk.ru/film/' + id + '/cast/?page=' + page, {
    'Accept'          : 'application/json',
    'Content-Type'    : 'application/json',
    'x-requested-with': 'XMLHttpRequest',
    'User-Agent'      : 'Mozilla/5.0 (iPhone; CPU iPhone OS 9_1 like Mac OS X) AppleWebKit/601.1.46 (KHTML, like Gecko) Version/9.0 Mobile/13B143 Safari/601.1'
  });

  const result = JSON.parse(toUTF8(body));

  result.page.cast.forEach((item) => {
    const person = Object.assign({}, result.models.basicPeople[item.id]);
    person.img = (person.img && person.img.photo && person.img.photo.x2)
      ? person.img.photo.x2.replace('width=120', 'width=360')
      : null;
    person.group = item.castGroup;
    staff.push(person);
  });

  if (!result.page.pagination.hasMore) {
    return staff;
  }

  return getFilmStaff(id, page + 1, staff);
}

export {search};
export {getFilm};
export {getFilmStaff};