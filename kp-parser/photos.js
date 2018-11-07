import request from 'request';
import mysql from 'mysql2/promise';

const mysqlConfig = {
  // host    : 'localhost',
  host    : '185.117.155.141',
  user    : 'flicktips',
  password: 'Aing6si',
  database: 'flicktips'
};

const run = async () => {
  const connection = await mysql.createConnection(mysqlConfig);

  const parse = async (minId = 1000) => {
    const [rows] = await connection.execute('SELECT id, kp_id FROM people WHERE kp_photo IS NULL AND id > ? LIMIT 1', [minId]);

    if (!rows.length) {
      connection.end();
      console.log('Complete!');
      return false;
    }

    const [{id, kp_id}] = rows;
    const url = `http://st.kp.yandex.net/images/actor_iphone/iphone360_${kp_id}.jpg`;

    request({
      url,
      method: 'HEAD'
    }, async (error, response) => {
      if (error) {
        await new Promise((resolve) => setTimeout(resolve, 5000));
        return parse(id);
      }

      if (response.request.uri.path !== '/images/no-poster.gif') {
        const newUrl = `//st.kp.yandex.net/images/actor_iphone/iphone360_${kp_id}.jpg`;
        await connection.execute('UPDATE people SET kp_photo = ? WHERE id = ?', [newUrl, id]);
        console.log(id, newUrl);
      } else {
        console.log(id, 'notFound!');
      }

      return parse(id);
    });
  };

  parse();
};

// request({
//   url: 'http://st.kp.yandex.net/images/actor_iphone/iphone360_321990.jpg',
//   method: 'HEAD'
// }, (error, response) => {
//   if (response.request.uri.path !== '/images/no-poster.gif') {
//
//   }
// });

run();